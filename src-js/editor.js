(function(app) {
  'use strict';

  app.lineDragState = null;

  app.getSectionDisplayTitle = function(section) {
    const meta = app.SECTION_META[section.type] || app.SECTION_META.custom;
    if (section.type === 'custom') return (section.customLabel || 'SECTION').toUpperCase();
    if (section.type === 'verse' && section.verseNumber) return `VERSE ${section.verseNumber}`;
    return meta.label;
  };

  app.addLineToSection = function(section, type, setFocus = true) {
    app.pushUndo();
    const line = app.createLine(type);
    if (type === 'grid') line.chords = '';
    section.lines.push(line);
    app.commitChange();
    if (setFocus) {
      setTimeout(() => {
        const input = document.querySelector(`.line-input[data-line-id="${line.id}"]`);
        if (input) input.focus();
      }, 50);
    }
  };

  function createActionBtn(label, accessibleName, onClick, focusKey) {
    const btn = document.createElement('button');
    if (focusKey) btn.dataset.focusKey = focusKey;
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = label;
    btn.setAttribute('aria-label', accessibleName);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createSmallBtn(label, onClick, focusKey) {
    const btn = document.createElement('button');
    if (focusKey) btn.dataset.focusKey = focusKey;
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-ghost';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createLineActionBtn(iconName, title, onClick, focusKey) {
    const btn = document.createElement('button');
    if (focusKey) btn.dataset.focusKey = focusKey;
    btn.type = 'button';
    btn.className = 'line-action-btn';
    btn.appendChild(app.icon(iconName));
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function clearSectionDropMarkers() {
    document.querySelectorAll('.section-card.drag-above, .section-card.drag-below').forEach(el => {
      el.classList.remove('drag-above', 'drag-below');
    });
  }

  function getSectionDropTarget(sourceId, x, y) {
    const sourceCard = Array.from(document.querySelectorAll('.section-card'))
      .find(card => card.dataset.sectionId === sourceId);
    if (sourceCard) {
      const sourceRect = sourceCard.getBoundingClientRect();
      if (
        x >= sourceRect.left && x <= sourceRect.left + sourceRect.width &&
        y >= sourceRect.top && y <= sourceRect.top + sourceRect.height
      ) return null;
    }

    const cards = Array.from(document.querySelectorAll('.section-card'))
      .filter(card => card.dataset.sectionId !== sourceId);
    if (!cards.length) return null;

    const rects = cards.map(card => ({ card, rect: card.getBoundingClientRect() }));
    const left = Math.min(...rects.map(item => item.rect.left));
    const right = Math.max(...rects.map(item => item.rect.left + item.rect.width));
    if (x < left - 48 || x > right + 48) return null;

    let target = rects.find(item => y >= item.rect.top && y <= item.rect.top + item.rect.height);
    if (!target) {
      target = rects.reduce((closest, item) => {
        const topDistance = Math.abs(y - item.rect.top);
        const bottomDistance = Math.abs(y - (item.rect.top + item.rect.height));
        const distance = Math.min(topDistance, bottomDistance);
        return !closest || distance < closest.distance ? { ...item, distance } : closest;
      }, null);
    }

    const rect = target.rect;
    return {
      sectionId: target.card.dataset.sectionId,
      position: y < rect.top + rect.height / 2 ? 'above' : 'below',
      card: target.card
    };
  }

  function focusSectionDragHandle(sectionId) {
    const card = Array.from(document.querySelectorAll('.section-card'))
      .find(item => item.dataset.sectionId === sectionId);
    card?.querySelector('.section-drag-handle')?.focus();
  }

  function moveSection(sourceId, targetId, position, restoreFocus = false) {
    const fromIdx = app.state.sections.findIndex(s => s.id === sourceId);
    const toIdx = app.state.sections.findIndex(s => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return false;

    let targetIdx = position === 'above' ? toIdx : toIdx + 1;
    if (fromIdx < targetIdx) targetIdx--;
    if (fromIdx === targetIdx) return false;

    app.pushUndo();
    const [moved] = app.state.sections.splice(fromIdx, 1);
    app.state.sections.splice(targetIdx, 0, moved);
    if (app.renumberVerses) app.renumberVerses(app.state.sections);
    app.commitChange();
    if (restoreFocus) focusSectionDragHandle(sourceId);
    return true;
  }

  function bindSectionReorder(section, card, dragHandle) {
    const startDrag = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      let isDragging = false;
      let currentTarget = null;
      const startX = e.clientX;
      const startY = e.clientY;

      const cleanup = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onCancel);
        dragHandle.releasePointerCapture?.(e.pointerId);
        document.body.classList.remove('section-reorder-active');
        card.classList.remove('dragging');
        dragHandle.classList.remove('is-dragging');
        clearSectionDropMarkers();
      };

      const onMove = moveEvent => {
        const movedFarEnough = Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3;
        if (!isDragging && !movedFarEnough) return;

        isDragging = true;
        app.sectionDragState = section.id;
        document.body.classList.add('section-reorder-active');
        card.classList.add('dragging');
        dragHandle.classList.add('is-dragging');
        clearSectionDropMarkers();

        currentTarget = getSectionDropTarget(section.id, moveEvent.clientX, moveEvent.clientY);
        if (currentTarget) {
          currentTarget.card.classList.add(currentTarget.position === 'above' ? 'drag-above' : 'drag-below');
        }
      };

      const onEnd = () => {
        const target = currentTarget;
        cleanup();
        app.sectionDragState = null;

        if (isDragging && target) {
          moveSection(section.id, target.sectionId, target.position);
        }
      };

      const onCancel = () => {
        cleanup();
        app.sectionDragState = null;
      };

      dragHandle.setPointerCapture?.(e.pointerId);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd, { once: true });
      document.addEventListener('pointercancel', onCancel, { once: true });
    };

    dragHandle.addEventListener('pointerdown', startDrag);
    dragHandle.addEventListener('click', e => e.stopPropagation());
    dragHandle.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
    dragHandle.addEventListener('keydown', event => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      const currentIndex = app.state.sections.findIndex(item => item.id === section.id);
      const targetIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
      const target = app.state.sections[targetIndex];
      if (!target) return;
      event.preventDefault();
      moveSection(section.id, target.id, event.key === 'ArrowUp' ? 'above' : 'below', true);
    });
  }

  // Section ids present after the previous render; null until the first render
  // so the initial load does not animate every card in.
  let renderedSectionIds = null;

  // Record which editor control has focus in terms that survive a full rebuild.
  function captureEditorFocus(cards) {
    const focused = document.activeElement;
    const key = focused?.dataset?.focusKey;
    const card = key ? focused.closest('.section-card') : null;
    if (!card) return null;
    const lineItem = focused.closest('.line-item');
    const lineItems = lineItem ? Array.from(card.querySelectorAll('.line-item')) : [];
    return {
      key,
      sectionId: card.dataset.sectionId,
      sectionIndex: cards.indexOf(card),
      lineId: lineItem?.dataset.lineId || null,
      lineIndex: lineItem ? lineItems.indexOf(lineItem) : -1
    };
  }

  function findFocusKey(scope, key) {
    return scope?.querySelectorAll(`[data-focus-key="${key}"]`)[0] || null;
  }

  function restoreEditorFocus(snapshot, cards) {
    if (!snapshot) return;
    const card = cards.find(item => item.dataset.sectionId === snapshot.sectionId);
    if (!card) {
      // The section was deleted: continue from the section that took its place.
      const next = cards[Math.min(snapshot.sectionIndex, cards.length - 1)];
      (findFocusKey(next, 'section-drag') || document.getElementById('btn-start-chart'))?.focus();
      return;
    }
    if (!snapshot.lineId) {
      findFocusKey(card, snapshot.key)?.focus();
      return;
    }
    const lineItems = Array.from(card.querySelectorAll('.line-item'));
    const lineItem = lineItems.find(item => item.dataset.lineId === snapshot.lineId);
    if (lineItem) {
      findFocusKey(lineItem, snapshot.key)?.focus();
      return;
    }
    // The line was deleted: focus the same control on its neighbour, or the add bar.
    const neighbour = lineItems[Math.min(snapshot.lineIndex, lineItems.length - 1)];
    (findFocusKey(neighbour, snapshot.key) || findFocusKey(card, 'add-lyric'))?.focus();
  }

  app.renderEditor = function() {
    const editorSections = document.getElementById('editor-sections');
    const emptyState = document.getElementById('empty-state');
    const addSectionArea = document.getElementById('add-section-area');
    if (!editorSections) return;

    const previousCards = Array.from(editorSections.querySelectorAll('.section-card'));
    const openOptions = new Set(previousCards
      .filter(card => card.querySelector('.section-options')?.open)
      .map(card => card.dataset.sectionId));
    const focusSnapshot = captureEditorFocus(previousCards);
    previousCards.forEach(card => {
      card.resizeObserver?.disconnect();
      card.remove();
    });

    const isEmpty = app.state.sections.length === 0;
    emptyState.hidden = !isEmpty;
    addSectionArea.hidden = isEmpty;

    const cards = app.state.sections.map((section, sIdx) => {
      const card = app.buildSectionCard(section, sIdx);
      if (openOptions.has(section.id)) card.querySelector('.section-options').open = true;
      if (renderedSectionIds && !renderedSectionIds.has(section.id)) card.classList.add('is-new');
      editorSections.appendChild(card);
      return card;
    });
    renderedSectionIds = new Set(app.state.sections.map(section => section.id));
    restoreEditorFocus(focusSnapshot, cards);
    app.updateStatusBar();
  };

  function buildSectionHeader(section, sIdx) {
    const header = document.createElement('div');
    header.className = 'section-card-header';
    const displayTitle = app.getSectionDisplayTitle(section);

    const collapseToggle = document.createElement('button');
    collapseToggle.type = 'button';
    collapseToggle.className = 'section-collapse-toggle';
    collapseToggle.dataset.focusKey = 'collapse';
    collapseToggle.appendChild(app.icon('chevron-down'));
    collapseToggle.title = 'Collapse/expand section';
    collapseToggle.setAttribute('aria-label', `${section.collapsed ? 'Expand' : 'Collapse'} ${displayTitle} section`);
    collapseToggle.setAttribute('aria-expanded', String(!section.collapsed));
    collapseToggle.addEventListener('click', e => {
      e.stopPropagation();
      app.toggleSectionCollapse(section.id);
    });

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'section-drag-handle';
    dragHandle.dataset.focusKey = 'section-drag';
    dragHandle.appendChild(app.icon('grip'));
    dragHandle.title = 'Drag to reorder, or use Alt+Arrow keys';
    dragHandle.setAttribute('aria-label', `Reorder ${displayTitle} section by dragging or with Alt+Arrow Up or Down`);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'section-type-select';
    typeSelect.dataset.focusKey = 'section-type';
    typeSelect.setAttribute('aria-label', 'Section type');
    Object.keys(app.SECTION_META).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === section.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      app.pushUndo();
      section.type = typeSelect.value;
      if (section.type === 'verse' && !section.verseNumber) {
        section.verseNumber = app.getNextVerseNumber(app.state.sections);
      }
      app.commitChange();
    });

    // Names the card for assistive tech; the type select shows it visually.
    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-card-title visually-hidden';
    titleSpan.id = `section-title-${section.id}`;
    titleSpan.textContent = displayTitle;

    let verseNumInput = null;
    if (section.type === 'verse') {
      verseNumInput = document.createElement('input');
      verseNumInput.className = 'verse-number-input';
      verseNumInput.dataset.focusKey = 'verse-number';
      verseNumInput.type = 'text';
      verseNumInput.inputMode = 'numeric';
      verseNumInput.setAttribute('pattern', '[0-9]*');
      verseNumInput.value = section.verseNumber || 1;
      verseNumInput.title = 'Verse number';
      verseNumInput.setAttribute('aria-label', 'Verse number');
      verseNumInput.addEventListener('click', () => verseNumInput.select());
      verseNumInput.addEventListener('change', () => {
        app.pushUndo();
        section.verseNumber = app.normalizeVerseNumber(verseNumInput.value) || 1;
        verseNumInput.value = String(section.verseNumber);
        app.commitChange();
      });
    }

    const fontScaleControl = document.createElement('label');
    fontScaleControl.className = 'section-font-scale-control';
    fontScaleControl.title = 'Section font size in preview and PDF';

    const fontScaleText = document.createElement('span');
    fontScaleText.textContent = 'Text';

    const fontScaleSelect = document.createElement('select');
    fontScaleSelect.className = 'section-font-scale-select';
    fontScaleSelect.dataset.focusKey = 'font-scale';
    fontScaleSelect.setAttribute('aria-label', 'Section font size');
    for (let percent = 100; percent <= 200; percent += 10) {
      const option = document.createElement('option');
      option.value = String(percent);
      option.textContent = `${percent}%`;
      if (percent === app.normalizeSectionFontScale(section.fontScale)) option.selected = true;
      fontScaleSelect.appendChild(option);
    }
    fontScaleSelect.addEventListener('change', () => {
      app.pushUndo();
      section.fontScale = app.normalizeSectionFontScale(fontScaleSelect.value);
      fontScaleSelect.value = String(section.fontScale);
      app.commitChange();
    });
    fontScaleControl.appendChild(fontScaleText);
    fontScaleControl.appendChild(fontScaleSelect);

    let customInput = null;
    if (section.type === 'custom') {
      customInput = document.createElement('input');
      customInput.className = 'form-input custom-label-input';
      customInput.dataset.focusKey = 'custom-label';
      customInput.placeholder = 'Label…';
      customInput.value = section.customLabel || '';
      customInput.setAttribute('aria-label', 'Custom section label');
      customInput.addEventListener('focus', () => app.snapshotTextEdit());
      customInput.addEventListener('blur', () => app.commitTextEdit());
      customInput.addEventListener('input', () => {
        section.customLabel = customInput.value;
        if (app.schedulePreview) app.schedulePreview();
        if (app.autoSave) app.autoSave();
      });
    }

    const actions = document.createElement('div');
    actions.className = 'section-card-actions';

    let repeatControl = null;
    if (section.type !== 'verse') {
      repeatControl = document.createElement('label');
      repeatControl.className = 'section-repeat-control';
      repeatControl.title = 'Repeat this section';

      const repeatText = document.createElement('span');
      repeatText.className = 'section-repeat-label';
      repeatText.textContent = 'Repeat';

      const repeatMark = document.createElement('span');
      repeatMark.className = 'section-repeat-mark';
      repeatMark.textContent = '×';

      const repeatInput = document.createElement('input');
      repeatInput.className = 'section-repeat-input';
      repeatInput.dataset.focusKey = 'repeat';
      repeatInput.type = 'number';
      repeatInput.min = '1';
      repeatInput.max = '99';
      repeatInput.value = section.repeat || '';
      repeatInput.placeholder = '-';
      repeatInput.setAttribute('aria-label', 'Repeat count');
      repeatInput.addEventListener('change', () => {
        app.pushUndo();
        section.repeat = app.normalizeRepeat(repeatInput.value);
        repeatInput.value = section.repeat === null ? '' : String(section.repeat);
        app.commitChange();
      });

      repeatControl.appendChild(repeatText);
      repeatControl.appendChild(repeatMark);
      repeatControl.appendChild(repeatInput);
    } else {
      actions.classList.add('section-card-actions-push');
    }

    const dupeBtn = createActionBtn('Duplicate', `Duplicate ${displayTitle} section`, () => {
      app.pushUndo();
      const copy = JSON.parse(JSON.stringify(section));
      copy.id = app.generateId();
      copy.lines.forEach(l => l.id = app.generateId());
      if (copy.type === 'verse') copy.verseNumber = app.getNextVerseNumber(app.state.sections);
      app.state.sections.splice(sIdx + 1, 0, copy);
      app.commitChange();
      setTimeout(() => {
        const newCard = document.querySelector(`[data-section-id="${copy.id}"]`);
        if (newCard) {
          newCard.classList.add('section-flash');
          newCard.scrollIntoView({ behavior: app.scrollBehavior(), block: 'center' });
          const firstInput = newCard.querySelector('.line-input');
          if (firstInput) firstInput.focus();
          setTimeout(() => newCard.classList.remove('section-flash'), 1500);
        }
      }, 100);
    }, 'duplicate');

    const collectBtn = createActionBtn('Collect', `Collect ${displayTitle} section for reuse`, () => {
      if (app.openCollectSectionModal) {
        app.openCollectSectionModal(section.id);
      }
    }, 'collect');

    const deleteBtn = createActionBtn('Delete', `Delete ${displayTitle} section`, () => {
      app.pushUndo();
      app.state.sections.splice(sIdx, 1);
      app.commitChange();
      app.showToast('Section deleted', 'info');
    }, 'delete-section');
    deleteBtn.classList.add('delete');

    actions.appendChild(collectBtn);
    actions.appendChild(dupeBtn);
    actions.appendChild(deleteBtn);

    // Keep secondary controls available without crowding the section title.
    const options = document.createElement('details');
    options.className = 'section-options';
    const summary = document.createElement('summary');
    summary.className = 'btn btn-sm btn-ghost';
    summary.dataset.focusKey = 'options';
    summary.textContent = 'Options';
    summary.setAttribute('aria-label', `Options for ${displayTitle} section`);
    const optionsContent = document.createElement('div');
    optionsContent.className = 'section-options-content';
    optionsContent.appendChild(fontScaleControl);
    if (repeatControl) optionsContent.appendChild(repeatControl);
    optionsContent.appendChild(actions);
    options.appendChild(summary);
    options.appendChild(optionsContent);

    header.appendChild(titleSpan);
    header.appendChild(collapseToggle);
    header.appendChild(dragHandle);
    header.appendChild(typeSelect);
    if (verseNumInput) header.appendChild(verseNumInput);
    if (customInput) header.appendChild(customInput);
    header.appendChild(options);

    return header;
  }

  function buildSectionBody(section, sIdx) {
    const body = document.createElement('div');
    body.className = 'section-card-body';

    const lineList = document.createElement('div');
    lineList.className = 'line-list';

    section.lines.forEach((line, lIdx) => {
      const lineEl = app.buildLineItem(section, line, sIdx, lIdx);
      lineList.appendChild(lineEl);
    });

    const addBar = document.createElement('div');
    addBar.className = 'add-line-bar';

    const addChordBtn = createSmallBtn('+ Chord', () => app.addLineToSection(section, 'chord'), 'add-chord');
    addChordBtn.style.color = 'var(--accent-chord)';
    
    const addLyricBtn = createSmallBtn('+ Lyric', () => app.addLineToSection(section, 'lyric'), 'add-lyric');
    
    const addInstructionBtn = createSmallBtn('+ Instruction', () => app.addLineToSection(section, 'instruction'), 'add-instruction');
    addInstructionBtn.style.color = 'var(--accent-intro)';

    const addBlankBtn = createSmallBtn('+ Blank', () => app.addLineToSection(section, 'blank', false), 'add-blank');
    
    const addGridBtn = createSmallBtn('+ Chord + Lyric', () => app.addLineToSection(section, 'grid'), 'add-grid');
    addGridBtn.style.color = 'var(--accent-primary)';

    addBar.appendChild(addChordBtn);
    addBar.appendChild(addLyricBtn);
    addBar.appendChild(addGridBtn);
    addBar.appendChild(addInstructionBtn);
    addBar.appendChild(addBlankBtn);

    const lineDropZone = document.createElement('div');
    lineDropZone.className = 'line-drop-zone';
    lineDropZone.dataset.sectionId = section.id;

    body.appendChild(lineList);
    body.appendChild(lineDropZone);
    body.appendChild(addBar);

    return body;
  }

  app.buildSectionCard = function(section, sIdx) {
    const card = document.createElement('div');
    card.className = `section-card section-card--${section.type}`;
    card.dataset.sectionId = section.id;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-labelledby', `section-title-${section.id}`);
    if (section.collapsed) card.classList.add('collapsed');

    const header = buildSectionHeader(section, sIdx);
    const body = buildSectionBody(section, sIdx);

    if (section.editorHeight) {
      body.style.height = section.editorHeight;
    }
    if (section.collapsed) body.classList.add('collapsed');

    card.appendChild(header);
    card.appendChild(body);

    const resizeObserver = new ResizeObserver(() => {
      const heightStyle = body.style.height;
      if (heightStyle && heightStyle !== section.editorHeight) {
        section.editorHeight = heightStyle;
        if (app.autoSave) app.autoSave();
      }
    });
    resizeObserver.observe(body);
    card.resizeObserver = resizeObserver;

    bindSectionReorder(section, card, header.querySelector('.section-drag-handle'));

    return card;
  };

  function focusLineDragHandle(lineId) {
    const handle = Array.from(document.querySelectorAll('.line-drag-handle'))
      .find(item => item.dataset.lineId === lineId);
    handle?.focus();
  }

  function clearLineDropMarkers() {
    document.querySelectorAll('.line-drag-above, .line-drop-zone.drag-over').forEach(element => {
      element.classList.remove('line-drag-above', 'drag-over');
    });
  }

  function getLineDropTarget(sourceSectionId, sourceLineId, x, y) {
    const sourceElement = Array.from(document.querySelectorAll('.line-item'))
      .find(element => element.dataset.sectionId === sourceSectionId && element.dataset.lineId === sourceLineId);
    if (sourceElement) {
      const sourceRect = sourceElement.getBoundingClientRect();
      if (
        x >= sourceRect.left && x <= sourceRect.left + sourceRect.width &&
        y >= sourceRect.top && y <= sourceRect.top + sourceRect.height
      ) return null;
    }

    const cards = Array.from(document.querySelectorAll('.section-card'));
    if (!cards.length) return null;
    const cardRects = cards.map(card => ({ card, rect: card.getBoundingClientRect() }));
    const left = Math.min(...cardRects.map(item => item.rect.left));
    const right = Math.max(...cardRects.map(item => item.rect.left + item.rect.width));
    if (x < left - 48 || x > right + 48) return null;

    let targetCard = cardRects.find(item => y >= item.rect.top && y <= item.rect.top + item.rect.height);
    if (!targetCard) {
      targetCard = cardRects.reduce((closest, item) => {
        const distance = Math.min(
          Math.abs(y - item.rect.top),
          Math.abs(y - (item.rect.top + item.rect.height))
        );
        return !closest || distance < closest.distance ? { ...item, distance } : closest;
      }, null);
    }

    const sectionId = targetCard.card.dataset.sectionId;
    const section = app.state.sections.find(item => item.id === sectionId);
    if (!section) return null;
    const lineElements = Array.from(targetCard.card.querySelectorAll('.line-item'))
      .filter(element => element.dataset.lineId !== sourceLineId);

    for (const element of lineElements) {
      const rect = element.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        return {
          sectionId,
          index: section.lines.findIndex(line => line.id === element.dataset.lineId),
          marker: element,
          markerClass: 'line-drag-above'
        };
      }
    }

    return {
      sectionId,
      index: section.lines.length,
      marker: targetCard.card.querySelector('.line-drop-zone'),
      markerClass: 'drag-over'
    };
  }

  function moveLineToIndex(sourceSectionId, lineId, targetSectionId, targetIndex, restoreFocus = false) {
    const sourceSection = app.state.sections.find(item => item.id === sourceSectionId);
    const targetSection = app.state.sections.find(item => item.id === targetSectionId);
    if (!sourceSection || !targetSection) return false;
    const sourceIndex = sourceSection.lines.findIndex(item => item.id === lineId);
    if (sourceIndex < 0) return false;

    let insertionIndex = targetIndex;
    if (sourceSection === targetSection && sourceIndex < insertionIndex) insertionIndex--;
    if (sourceSection === targetSection && sourceIndex === insertionIndex) return false;

    app.pushUndo();
    const [moved] = sourceSection.lines.splice(sourceIndex, 1);
    targetSection.lines.splice(insertionIndex, 0, moved);
    app.commitChange();
    if (restoreFocus) focusLineDragHandle(lineId);
    return true;
  }

  function bindLineReorder(section, line, item, dragHandle) {
    dragHandle.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      let isDragging = false;
      let currentTarget = null;

      const cleanup = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onCancel);
        dragHandle.releasePointerCapture?.(event.pointerId);
        document.body.classList.remove('line-reorder-active');
        item.classList.remove('dragging');
        dragHandle.classList.remove('is-dragging');
        clearLineDropMarkers();
      };

      const onMove = moveEvent => {
        const movedFarEnough = Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3;
        if (!isDragging && !movedFarEnough) return;
        isDragging = true;
        app.lineDragState = { sectionId: section.id, lineId: line.id };
        document.body.classList.add('line-reorder-active');
        item.classList.add('dragging');
        dragHandle.classList.add('is-dragging');
        clearLineDropMarkers();
        currentTarget = getLineDropTarget(section.id, line.id, moveEvent.clientX, moveEvent.clientY);
        currentTarget?.marker?.classList.add(currentTarget.markerClass);
      };

      const onEnd = () => {
        const target = currentTarget;
        cleanup();
        app.lineDragState = null;
        if (isDragging && target) {
          moveLineToIndex(section.id, line.id, target.sectionId, target.index);
        }
      };

      const onCancel = () => {
        cleanup();
        app.lineDragState = null;
      };

      dragHandle.setPointerCapture?.(event.pointerId);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd, { once: true });
      document.addEventListener('pointercancel', onCancel, { once: true });
    });
  }

  function moveLineByKeyboard(sectionId, lineId, direction) {
    const sectionIndex = app.state.sections.findIndex(item => item.id === sectionId);
    const sourceSection = app.state.sections[sectionIndex];
    if (!sourceSection) return false;
    const lineIndex = sourceSection.lines.findIndex(item => item.id === lineId);
    if (lineIndex < 0) return false;

    let targetSection = sourceSection;
    let targetIndex;
    if (direction < 0) {
      if (lineIndex > 0) {
        targetIndex = lineIndex - 1;
      } else {
        targetSection = app.state.sections[sectionIndex - 1];
        if (!targetSection) return false;
        targetIndex = targetSection.lines.length;
      }
    } else if (lineIndex < sourceSection.lines.length - 1) {
      targetIndex = lineIndex + 1;
    } else {
      targetSection = app.state.sections[sectionIndex + 1];
      if (!targetSection) return false;
      targetIndex = 0;
    }

    app.pushUndo();
    const [moved] = sourceSection.lines.splice(lineIndex, 1);
    targetSection.lines.splice(targetIndex, 0, moved);
    app.commitChange();
    focusLineDragHandle(lineId);
    return true;
  }

  app.buildLineItem = function(section, line, sIdx, lIdx) {
    const item = document.createElement('div');
    item.className = 'line-item';
    item.dataset.lineId = line.id;
    item.dataset.sectionId = section.id;

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'line-drag-handle';
    dragHandle.dataset.focusKey = 'line-drag';
    dragHandle.dataset.lineId = line.id;
    dragHandle.dataset.sectionId = section.id;
    dragHandle.appendChild(app.icon('grip'));
    dragHandle.title = 'Drag to reorder or use Alt+Arrow keys';
    dragHandle.setAttribute('aria-label', 'Reorder line by dragging or with Alt+Arrow Up or Down');
    dragHandle.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
    dragHandle.addEventListener('keydown', event => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      if (moveLineByKeyboard(section.id, line.id, event.key === 'ArrowUp' ? -1 : 1)) {
        event.preventDefault();
      }
    });
    bindLineReorder(section, line, item, dragHandle);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'line-type-select';
    typeSelect.dataset.focusKey = 'line-type';
    typeSelect.setAttribute('aria-label', 'Line type');
    [
      { value: 'chord', label: 'Chord' },
      { value: 'lyric', label: 'Lyric' },
      { value: 'instruction', label: 'Instruction' },
      { value: 'grid', label: 'Chord + Lyric' },
      { value: 'blank', label: 'Blank' }
    ].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === line.type) o.selected = true;
      typeSelect.appendChild(o);
    });
    typeSelect.addEventListener('change', () => {
      app.pushUndo();
      line.type = typeSelect.value;
      if (line.type !== 'lyric' && line.type !== 'grid') line.bold = false;
      if (line.type === 'grid' && line.chords === undefined) line.chords = '';
      app.commitChange();
    });

    let inputsWrapper = null;
    let input = null;
    let gridInputs = null;

    if (line.type === 'blank') {
      inputsWrapper = document.createElement('div');
      inputsWrapper.className = 'blank-line-editor';
      inputsWrapper.textContent = 'Blank line';
    } else if (line.type === 'grid') {
      gridInputs = document.createElement('div');
      gridInputs.className = 'grid-inputs';

      const chordInput = document.createElement('input');
      chordInput.className = 'line-input grid-chords';
      chordInput.dataset.focusKey = 'chords';
      chordInput.dataset.lineId = line.id;
      chordInput.type = 'text';
      chordInput.value = line.chords || '';
      chordInput.placeholder = 'e.g. Am  C  G  D';
      chordInput.title = 'Use spaces to place chords above the matching lyric';
      chordInput.setAttribute('aria-label', `Line ${lIdx + 1} chords`);
      chordInput.addEventListener('focus', () => app.snapshotTextEdit());
      chordInput.addEventListener('blur', () => app.commitTextEdit());
      chordInput.addEventListener('input', () => {
        line.chords = chordInput.value;
        if (app.schedulePreview) app.schedulePreview();
        if (app.autoSave) app.autoSave();
      });
      gridInputs.appendChild(chordInput);

      const lyricInput = document.createElement('input');
      lyricInput.className = `line-input grid-lyric${line.bold ? ' lyric-bold' : ''}`;
      lyricInput.dataset.focusKey = 'content';
      lyricInput.dataset.lineId = line.id;
      lyricInput.type = 'text';
      lyricInput.value = line.content;
      lyricInput.placeholder = 'Lyrics go here…';
      lyricInput.setAttribute('aria-label', `Line ${lIdx + 1} lyrics`);
      lyricInput.addEventListener('focus', () => app.snapshotTextEdit());
      lyricInput.addEventListener('blur', () => app.commitTextEdit());
      lyricInput.addEventListener('input', () => {
        line.content = lyricInput.value;
        lyricInput.classList.toggle('has-inline-bold', lyricInput.value.includes('**'));
        if (app.schedulePreview) app.schedulePreview();
        if (app.autoSave) app.autoSave();
      });
      if (line.content.includes('**')) lyricInput.classList.add('has-inline-bold');
      gridInputs.appendChild(lyricInput);

      // Keep both editable rows on the same columns while scrolling long text.
      chordInput.addEventListener('scroll', () => { lyricInput.scrollLeft = chordInput.scrollLeft; });
      lyricInput.addEventListener('scroll', () => { chordInput.scrollLeft = lyricInput.scrollLeft; });

      lyricInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          app.pushUndo();
          const newLine = app.createLine('grid', '', line.bold);
          section.lines.splice(lIdx + 1, 0, newLine);
          app.commitChange();
          setTimeout(() => {
            const nextInput = document.querySelector(`.grid-lyric[data-line-id="${newLine.id}"]`);
            if (nextInput) nextInput.focus();
          }, 50);
        }
      });
      inputsWrapper = gridInputs;
    } else {
      input = document.createElement('input');
      input.className = `line-input ${line.type}${line.bold ? ' lyric-bold' : ''}`;
      input.dataset.focusKey = 'content';
      input.dataset.lineId = line.id;
      input.value = line.content;
      input.placeholder = line.type === 'chord' ? 'e.g. Am, G, C, F' : line.type === 'instruction' ? 'e.g. [Drum fill]' : 'Lyrics… use **bold** for partial bold';
      const inputTypeName = line.type === 'chord' ? 'chords' : line.type === 'instruction' ? 'instruction' : 'lyrics';
      input.setAttribute('aria-label', `Line ${lIdx + 1} ${inputTypeName}`);
      input.addEventListener('focus', () => app.snapshotTextEdit());
      input.addEventListener('blur', () => app.commitTextEdit());
      input.addEventListener('input', () => {
        line.content = input.value;
        input.classList.toggle('has-inline-bold', input.value.includes('**'));
        if (app.schedulePreview) app.schedulePreview();
        if (app.autoSave) app.autoSave();
      });
      if (line.content.includes('**')) input.classList.add('has-inline-bold');

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          app.pushUndo();
          const newLine = app.createLine(line.type, '', line.bold);
          section.lines.splice(lIdx + 1, 0, newLine);
          app.commitChange();
          setTimeout(() => {
            const nextInput = document.querySelector(`.line-input[data-line-id="${newLine.id}"]`);
            if (nextInput) nextInput.focus();
          }, 50);
        }
      });
      inputsWrapper = input;
    }

    let boldBtn = null;
    if (line.type === 'lyric' || line.type === 'grid') {
      boldBtn = document.createElement('button');
      boldBtn.className = `bold-toggle ${line.bold ? 'active' : ''}`;
      boldBtn.dataset.focusKey = 'bold';
      boldBtn.type = 'button';
      boldBtn.textContent = 'B';
      boldBtn.title = 'Toggle bold (emphasized lyric)';
      boldBtn.setAttribute('aria-label', `Bold line ${lIdx + 1}`);
      boldBtn.setAttribute('aria-pressed', String(!!line.bold));
      boldBtn.addEventListener('click', () => {
        app.pushUndo();
        line.bold = !line.bold;
        app.commitChange();
      });
    }

    const actions = document.createElement('div');
    actions.className = 'line-actions';

    const moveUpBtn = createLineActionBtn('arrow-up', `Move line ${lIdx + 1} up`, () => {
      if (lIdx === 0) return;
      app.pushUndo();
      [section.lines[lIdx - 1], section.lines[lIdx]] = [section.lines[lIdx], section.lines[lIdx - 1]];
      app.commitChange();
    }, 'move-up');

    const moveDownBtn = createLineActionBtn('arrow-down', `Move line ${lIdx + 1} down`, () => {
      if (lIdx >= section.lines.length - 1) return;
      app.pushUndo();
      [section.lines[lIdx], section.lines[lIdx + 1]] = [section.lines[lIdx + 1], section.lines[lIdx]];
      app.commitChange();
    }, 'move-down');

    const deleteBtn = createLineActionBtn('close', `Delete line ${lIdx + 1}`, () => {
      app.pushUndo();
      section.lines.splice(lIdx, 1);
      app.commitChange();
    }, 'delete-line');
    deleteBtn.classList.add('delete');

    actions.appendChild(moveUpBtn);
    actions.appendChild(moveDownBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(dragHandle);
    item.appendChild(typeSelect);
    item.appendChild(inputsWrapper);
    if (boldBtn) item.appendChild(boldBtn);
    item.appendChild(actions);

    return item;
  };

})(window.ChartApp = window.ChartApp || {});
