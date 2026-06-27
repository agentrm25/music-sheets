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
        const inputList = document.querySelectorAll(`[data-section-id="${section.id}"] .line-input`);
        if (inputList.length) inputList[inputList.length - 1].focus();
      }, 50);
    }
  };

  function createActionBtn(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-icon btn-sm';
    btn.innerHTML = icon;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createSmallBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createLineActionBtn(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'line-action-btn';
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function clearSectionDropMarkers() {
    document.querySelectorAll('.section-card.drag-above, .section-card.drag-below').forEach(el => {
      el.classList.remove('drag-above', 'drag-below');
    });
  }

  function getSectionDropTarget(sourceId, x, y) {
    let targetCard = document.elementFromPoint(x, y)?.closest('.section-card');
    if (!targetCard || targetCard.dataset.sectionId === sourceId) return null;

    const rect = targetCard.getBoundingClientRect();
    return {
      sectionId: targetCard.dataset.sectionId,
      position: y < rect.top + rect.height / 2 ? 'above' : 'below',
      card: targetCard
    };
  }

  function moveSection(sourceId, targetId, position) {
    const fromIdx = app.state.sections.findIndex(s => s.id === sourceId);
    const toIdx = app.state.sections.findIndex(s => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return false;

    let targetIdx = position === 'above' ? toIdx : toIdx + 1;
    if (fromIdx < targetIdx) targetIdx--;
    if (fromIdx === targetIdx) return false;

    app.pushUndo();
    const [moved] = app.state.sections.splice(fromIdx, 1);
    app.state.sections.splice(targetIdx, 0, moved);
    app.pushUndo();
    app.commitChange();
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
  }

  app.renderEditor = function() {
    const editorSections = document.getElementById('editor-sections');
    const emptyState = document.getElementById('empty-state');
    const addSectionArea = document.getElementById('add-section-area');
    if (!editorSections) return;

    const cards = editorSections.querySelectorAll('.section-card');
    cards.forEach(c => c.remove());

    if (app.state.sections.length === 0) {
      emptyState.style.display = 'flex';
      addSectionArea.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      addSectionArea.style.display = 'flex';

      app.state.sections.forEach((section, sIdx) => {
        const card = app.buildSectionCard(section, sIdx);
        editorSections.appendChild(card);
      });
    }
    app.updateStatusBar();
  };

  function buildSectionHeader(section, sIdx) {
    const header = document.createElement('div');
    header.className = 'section-card-header';

    const collapseToggle = document.createElement('button');
    collapseToggle.className = 'section-collapse-toggle';
    collapseToggle.innerHTML = '<span class="chevron">▾</span>';
    collapseToggle.title = 'Collapse/expand section';
    collapseToggle.addEventListener('click', e => {
      e.stopPropagation();
      app.toggleSectionCollapse(section.id);
    });

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'section-drag-handle';
    dragHandle.textContent = '✋';
    dragHandle.title = 'Drag section to reorder';
    dragHandle.setAttribute('aria-label', 'Drag section to reorder');

    const typeSelect = document.createElement('select');
    typeSelect.className = 'section-type-select';
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

    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-card-title';
    titleSpan.textContent = app.getSectionDisplayTitle(section);

    let verseNumInput = null;
    if (section.type === 'verse') {
      verseNumInput = document.createElement('input');
      verseNumInput.className = 'verse-number-input';
      verseNumInput.type = 'number';
      verseNumInput.min = '1';
      verseNumInput.max = '99';
      verseNumInput.value = section.verseNumber || 1;
      verseNumInput.title = 'Verse number';
      verseNumInput.addEventListener('change', () => {
        app.pushUndo();
        section.verseNumber = parseInt(verseNumInput.value) || 1;
        app.commitChange();
      });
    }

    let customInput = null;
    if (section.type === 'custom') {
      customInput = document.createElement('input');
      customInput.className = 'form-input custom-label-input';
      customInput.placeholder = 'Label…';
      customInput.value = section.customLabel || '';
      customInput.addEventListener('focus', () => app.snapshotTextEdit());
      customInput.addEventListener('blur', () => app.commitTextEdit());
      customInput.addEventListener('input', () => {
        section.customLabel = customInput.value;
        if (app.renderPreview) app.renderPreview();
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
      repeatInput.type = 'number';
      repeatInput.min = '1';
      repeatInput.max = '99';
      repeatInput.value = section.repeat || '';
      repeatInput.placeholder = '-';
      repeatInput.setAttribute('aria-label', 'Repeat count');
      repeatInput.addEventListener('change', () => {
        app.pushUndo();
        section.repeat = repeatInput.value ? parseInt(repeatInput.value) : null;
        app.commitChange();
      });

      repeatControl.appendChild(repeatText);
      repeatControl.appendChild(repeatMark);
      repeatControl.appendChild(repeatInput);
    } else {
      actions.classList.add('section-card-actions-push');
    }

    const dupeBtn = createActionBtn('📋', 'Duplicate section', () => {
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
          newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstInput = newCard.querySelector('.line-input');
          if (firstInput) firstInput.focus();
          setTimeout(() => newCard.classList.remove('section-flash'), 1500);
        }
      }, 100);
    });

    const collectBtn = createActionBtn('☆', 'Save section to collected', () => {
      if (app.openCollectSectionModal) {
        app.openCollectSectionModal(section.id);
      }
    });

    const deleteBtn = createActionBtn('🗑', 'Delete section', () => {
      app.pushUndo();
      app.state.sections.splice(sIdx, 1);
      app.commitChange();
      app.showToast('Section deleted', 'info');
    });
    deleteBtn.classList.add('delete');

    actions.appendChild(collectBtn);
    actions.appendChild(dupeBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(collapseToggle);
    header.appendChild(dragHandle);
    header.appendChild(typeSelect);
    if (verseNumInput) header.appendChild(verseNumInput);
    if (customInput) header.appendChild(customInput);
    if (repeatControl) header.appendChild(repeatControl);
    header.appendChild(actions);

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

    const addChordBtn = createSmallBtn('+ Chord', () => app.addLineToSection(section, 'chord'));
    addChordBtn.style.color = 'var(--accent-chord)';
    
    const addLyricBtn = createSmallBtn('+ Lyric', () => app.addLineToSection(section, 'lyric'));
    
    const addInstructionBtn = createSmallBtn('+ Instruction', () => app.addLineToSection(section, 'instruction'));
    addInstructionBtn.style.color = 'var(--accent-intro)';
    
    const addGridBtn = createSmallBtn('+ Chord + Lyric', () => app.addLineToSection(section, 'grid'));
    addGridBtn.style.color = 'var(--accent-primary)';

    addBar.appendChild(addChordBtn);
    addBar.appendChild(addLyricBtn);
    addBar.appendChild(addGridBtn);
    addBar.appendChild(addInstructionBtn);

    const lineDropZone = document.createElement('div');
    lineDropZone.className = 'line-drop-zone';
    lineDropZone.addEventListener('dragover', e => {
      if (!app.lineDragState) return;
      e.preventDefault();
      e.stopPropagation();
      lineDropZone.classList.add('drag-over');
    });
    lineDropZone.addEventListener('dragleave', () => lineDropZone.classList.remove('drag-over'));
    lineDropZone.addEventListener('drop', e => {
      if (!app.lineDragState) return;
      e.preventDefault();
      e.stopPropagation();
      lineDropZone.classList.remove('drag-over');
      const sourceSec = app.state.sections.find(s => s.id === app.lineDragState.sectionId);
      if (!sourceSec) return;
      const srcIdx = sourceSec.lines.findIndex(l => l.id === app.lineDragState.lineId);
      if (srcIdx < 0) return;
      app.pushUndo();
      const [moved] = sourceSec.lines.splice(srcIdx, 1);
      section.lines.push(moved);
      app.lineDragState = null;
      app.commitChange();
    });

    body.appendChild(lineList);
    body.appendChild(lineDropZone);
    body.appendChild(addBar);

    return body;
  }

  app.buildSectionCard = function(section, sIdx) {
    const card = document.createElement('div');
    card.className = `section-card section-card--${section.type}`;
    card.dataset.sectionId = section.id;
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

    bindSectionReorder(section, card, header.querySelector('.section-drag-handle'));

    return card;
  };

  app.buildLineItem = function(section, line, sIdx, lIdx) {
    const item = document.createElement('div');
    item.className = 'line-item';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'line-drag-handle';
    dragHandle.innerHTML = '⠿';
    dragHandle.draggable = true;
    dragHandle.title = 'Drag to reorder';
    dragHandle.addEventListener('dragstart', e => {
      e.stopPropagation();
      app.lineDragState = { sectionId: section.id, lineId: line.id };
      e.dataTransfer.setData('application/x-line-drag', 'line');
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    dragHandle.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      app.lineDragState = null;
      document.querySelectorAll('.line-drag-above, .line-drag-below').forEach(el => {
        el.classList.remove('line-drag-above', 'line-drag-below');
      });
    });

    item.addEventListener('dragover', e => {
      if (!app.lineDragState) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      item.classList.remove('line-drag-above', 'line-drag-below');
      item.classList.add(e.clientY < midY ? 'line-drag-above' : 'line-drag-below');
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('line-drag-above', 'line-drag-below');
    });
    item.addEventListener('drop', e => {
      if (!app.lineDragState) return;
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('line-drag-above', 'line-drag-below');
      const sourceSec = app.state.sections.find(s => s.id === app.lineDragState.sectionId);
      if (!sourceSec) return;
      const srcIdx = sourceSec.lines.findIndex(l => l.id === app.lineDragState.lineId);
      if (srcIdx < 0) return;
      const rect = item.getBoundingClientRect();
      let targetIdx = e.clientY < (rect.top + rect.height / 2) ? lIdx : lIdx + 1;
      app.pushUndo();
      const [moved] = sourceSec.lines.splice(srcIdx, 1);
      if (sourceSec.id === section.id && srcIdx < targetIdx) targetIdx--;
      section.lines.splice(targetIdx, 0, moved);
      app.lineDragState = null;
      app.commitChange();
    });

    const indicator = document.createElement('div');
    indicator.className = `line-type-indicator ${line.type}${line.bold ? ' lyric-bold' : ''}`;

    const typeSelect = document.createElement('select');
    typeSelect.className = 'line-type-select';
    [
      { value: 'chord', label: 'Chord' },
      { value: 'lyric', label: 'Lyric' },
      { value: 'instruction', label: 'Instruction' },
      { value: 'grid', label: 'Chord + Lyric' }
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

    if (line.type === 'grid') {
      gridInputs = document.createElement('div');
      gridInputs.className = 'grid-inputs';

      const chordInput = document.createElement('input');
      chordInput.className = 'line-input grid-chords';
      chordInput.type = 'text';
      chordInput.value = line.chords || '';
      chordInput.placeholder = 'e.g. Am  C  G  D';
      chordInput.addEventListener('focus', () => app.snapshotTextEdit());
      chordInput.addEventListener('blur', () => app.commitTextEdit());
      chordInput.addEventListener('input', () => {
        line.chords = chordInput.value;
        if (app.renderPreview) app.renderPreview();
        if (app.autoSave) app.autoSave();
      });
      gridInputs.appendChild(chordInput);

      const lyricInput = document.createElement('input');
      lyricInput.className = `line-input grid-lyric${line.bold ? ' lyric-bold' : ''}`;
      lyricInput.type = 'text';
      lyricInput.value = line.content;
      lyricInput.placeholder = 'Lyrics go here…';
      lyricInput.addEventListener('focus', () => app.snapshotTextEdit());
      lyricInput.addEventListener('blur', () => app.commitTextEdit());
      lyricInput.addEventListener('input', () => {
        line.content = lyricInput.value;
        lyricInput.classList.toggle('has-inline-bold', lyricInput.value.includes('**'));
        if (app.renderPreview) app.renderPreview();
        if (app.autoSave) app.autoSave();
      });
      if (line.content.includes('**')) lyricInput.classList.add('has-inline-bold');
      gridInputs.appendChild(lyricInput);

      lyricInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          app.pushUndo();
          const newLine = app.createLine('grid', '', line.bold);
          section.lines.splice(lIdx + 1, 0, newLine);
          app.commitChange();
          setTimeout(() => {
            const card = document.querySelector(`[data-section-id="${section.id}"]`);
            if (card) {
              const inputs = card.querySelectorAll('.grid-lyric');
              if (inputs[lIdx + 1]) inputs[lIdx + 1].focus();
            }
          }, 50);
        }
      });
      inputsWrapper = gridInputs;
    } else {
      input = document.createElement('input');
      input.className = `line-input ${line.type}${line.bold ? ' lyric-bold' : ''}`;
      input.value = line.content;
      input.placeholder = line.type === 'chord' ? 'e.g. Am, G, C, F' : line.type === 'instruction' ? 'e.g. [Drum fill]' : 'Lyrics… use **bold** for partial bold';
      input.addEventListener('focus', () => app.snapshotTextEdit());
      input.addEventListener('blur', () => app.commitTextEdit());
      input.addEventListener('input', () => {
        line.content = input.value;
        input.classList.toggle('has-inline-bold', input.value.includes('**'));
        if (app.renderPreview) app.renderPreview();
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
            const card = document.querySelector(`[data-section-id="${section.id}"]`);
            if (card) {
              const inputs = card.querySelectorAll('.line-input');
              if (inputs[lIdx + 1]) inputs[lIdx + 1].focus();
            }
          }, 50);
        }
      });
      inputsWrapper = input;
    }

    let boldBtn = null;
    if (line.type === 'lyric' || line.type === 'grid') {
      boldBtn = document.createElement('button');
      boldBtn.className = `bold-toggle ${line.bold ? 'active' : ''}`;
      boldBtn.textContent = 'B';
      boldBtn.title = 'Toggle bold (emphasized lyric)';
      boldBtn.addEventListener('click', () => {
        app.pushUndo();
        line.bold = !line.bold;
        app.commitChange();
      });
    }

    const actions = document.createElement('div');
    actions.className = 'line-actions';

    const moveUpBtn = createLineActionBtn('↑', 'Move up', () => {
      if (lIdx === 0) return;
      app.pushUndo();
      [section.lines[lIdx - 1], section.lines[lIdx]] = [section.lines[lIdx], section.lines[lIdx - 1]];
      app.commitChange();
    });

    const moveDownBtn = createLineActionBtn('↓', 'Move down', () => {
      if (lIdx >= section.lines.length - 1) return;
      app.pushUndo();
      [section.lines[lIdx], section.lines[lIdx + 1]] = [section.lines[lIdx + 1], section.lines[lIdx]];
      app.commitChange();
    });

    const deleteBtn = createLineActionBtn('×', 'Delete line', () => {
      app.pushUndo();
      section.lines.splice(lIdx, 1);
      app.commitChange();
    });
    deleteBtn.classList.add('delete');

    actions.appendChild(moveUpBtn);
    actions.appendChild(moveDownBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(dragHandle);
    item.appendChild(indicator);
    item.appendChild(typeSelect);
    item.appendChild(inputsWrapper);
    if (boldBtn) item.appendChild(boldBtn);
    item.appendChild(actions);

    return item;
  };

})(window.ChartApp = window.ChartApp || {});
