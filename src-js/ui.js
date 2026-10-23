(function(app) {
  'use strict';

  app.commitChange = function() {
    if (app.refreshUndoState) app.refreshUndoState();
    if (app.renderEditor) app.renderEditor();
    if (app.renderPreview) app.renderPreview();
    if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
    if (app.autoSave) app.autoSave();
  };

  const TOAST_DURATION_MS = 3500;
  const TOAST_ACTION_DURATION_MS = 6000;
  const MAX_TOASTS = 3;
  const TOAST_FADE_MS = 300;
  const TOAST_ICONS = { success: 'check', error: 'alert', info: 'info' };

  // Toasts that offer Undo for the chart change that produced them. The offer
  // is withdrawn as soon as chart history moves on, so the button can never
  // undo some later, unrelated edit.
  const undoToasts = new Set();

  app.expireUndoToasts = function() {
    const token = app.historyToken ? app.historyToken() : null;
    undoToasts.forEach(entry => {
      if (entry.token === token) return;
      entry.button.remove();
      undoToasts.delete(entry);
    });
  };

  // options.undo: offer an Undo button for the change just committed.
  // options.action: { label, onClick } for any other single follow-up.
  // options.replace: a key; a newer toast with the same key replaces the
  // older one instead of stacking (e.g. pressing Transpose repeatedly).
  app.showToast = function(message, type = 'info', options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    if (options.replace) {
      container.querySelectorAll('.toast').forEach(existing => {
        if (existing.dataset.replaceKey === options.replace) existing.remove();
      });
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    if (options.replace) toast.dataset.replaceKey = options.replace;
    // Errors interrupt; everything else rides the container's polite region.
    if (type === 'error') toast.setAttribute('role', 'alert');
    toast.appendChild(app.icon(TOAST_ICONS[type] || TOAST_ICONS.info));
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    const action = options.undo && app.undo
      ? { label: 'Undo', onClick: () => app.undo(), undo: true }
      : options.action;
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action-btn';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        if (action.undo) {
          const entry = [...undoToasts].find(item => item.button === button);
          if (!entry) return;
          undoToasts.delete(entry);
        }
        button.remove();
        action.onClick();
        dismiss();
      });
      toast.appendChild(button);
      if (action.undo) undoToasts.add({ button, token: app.historyToken ? app.historyToken() : null });
    }
    container.appendChild(toast);
    // Keep the stack short so toasts never bury the chart.
    const toasts = Array.from(container.querySelectorAll('.toast'));
    toasts.slice(0, Math.max(0, toasts.length - MAX_TOASTS)).forEach(old => old.remove());

    // Hovering or focusing a toast pauses its countdown so it can be read.
    let remaining = action ? TOAST_ACTION_DURATION_MS : TOAST_DURATION_MS;
    let startedAt = Date.now();
    let timer = null;
    function dismiss() {
      clearTimeout(timer);
      undoToasts.forEach(entry => { if (toast.contains(entry.button)) undoToasts.delete(entry); });
      toast.classList.add('fadeout');
      setTimeout(() => toast.remove(), TOAST_FADE_MS);
    }
    const resume = () => {
      toast.dataset.paused = 'false';
      startedAt = Date.now();
      timer = setTimeout(dismiss, remaining);
    };
    const pause = () => {
      toast.dataset.paused = 'true';
      clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    };
    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', resume);
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', resume);
    resume();
  };

  const modalStack = [];
  const focusableSelector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function resolveModal(modalOrId) {
    return typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
  }

  function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(focusableSelector)).filter(element => !element.hidden && !element.disabled);
  }

  function handleModalKeydown(event) {
    const entry = modalStack.at(-1);
    if (!entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      app.closeModal(entry.modal, 'escape');
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(entry.modal);
    if (!focusable.length) {
      event.preventDefault();
      entry.modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!entry.modal.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  app.openModal = function(modalOrId, options = {}) {
    const modal = resolveModal(modalOrId);
    if (!modal) return false;
    const existing = modalStack.find(entry => entry.modal === modal);
    if (existing) app.closeModal(modal, 'replace');

    const entry = {
      modal,
      opener: document.activeElement,
      onClose: typeof options.onClose === 'function' ? options.onClose : null
    };
    modalStack.push(entry);
    if (modalStack.length === 1) document.addEventListener('keydown', handleModalKeydown);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    const initialFocus = options.initialFocus || getFocusableElements(modal)[0] || modal;
    if (initialFocus === modal && modal.getAttribute('tabindex') === null) modal.setAttribute('tabindex', '-1');
    initialFocus.focus();
    return true;
  };

  app.closeModal = function(modalOrId, reason = 'close') {
    const modal = resolveModal(modalOrId);
    const index = modalStack.findIndex(entry => entry.modal === modal);
    if (index < 0) return false;
    const [entry] = modalStack.splice(index, 1);
    entry.modal.hidden = true;
    entry.modal.setAttribute('aria-hidden', 'true');
    if (entry.onClose) entry.onClose(reason);
    if (!modalStack.length) document.removeEventListener('keydown', handleModalKeydown);
    if (entry.opener && typeof entry.opener.focus === 'function') entry.opener.focus();
    return true;
  };

  // Clicking the backdrop dismisses dialogs marked data-backdrop-dismiss.
  // Decisions (confirm/alert) and pasted imports stay open until answered.
  // A drag that starts inside the dialog (e.g. selecting text) and ends on
  // the backdrop also produces a backdrop click, so require both ends.
  app.bindModalBackdrops = function() {
    let pressStartedOnOverlay = false;
    document.addEventListener('mousedown', event => {
      pressStartedOnOverlay = Boolean(event.target?.classList?.contains('modal-overlay'));
    });
    document.addEventListener('click', event => {
      const overlay = event.target;
      if (!pressStartedOnOverlay || !overlay?.classList?.contains('modal-overlay')) return;
      if (overlay.dataset.backdropDismiss !== 'true') return;
      app.closeModal(overlay, 'backdrop');
    });
  };

  app.hasOpenModal = function() {
    return modalStack.length > 0;
  };

  // options: { title, confirmLabel, danger }. Destructive (danger) is the
  // default so an unlabelled confirm never looks safer than it is.
  app.showConfirm = function(message, onConfirm, options = {}) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    const { title = 'Are you sure?', confirmLabel = 'Confirm', danger = true } = options;
    const titleEl = document.getElementById('confirm-modal-title');
    if (titleEl) titleEl.textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle('btn-danger', danger);
    okBtn.classList.toggle('btn-primary', !danger);

    const cleanup = () => {
      cancelBtn.removeEventListener('click', onCancelClick);
      okBtn.removeEventListener('click', onOkClick);
    };

    const onCancelClick = () => app.closeModal(modal, 'cancel');
    const onOkClick = () => {
      app.closeModal(modal, 'confirm');
      onConfirm();
    };

    cancelBtn.addEventListener('click', onCancelClick);
    okBtn.addEventListener('click', onOkClick);
    app.openModal(modal, { initialFocus: cancelBtn, onClose: cleanup });
  };

  app.showAlert = function(message, title = 'Notice') {
    const modal = document.getElementById('alert-modal');
    if (!modal) return;
    document.getElementById('alert-modal-title').textContent = title;
    document.getElementById('alert-message').textContent = message;

    const okBtn = document.getElementById('alert-ok');
    const onOkClick = () => app.closeModal(modal, 'acknowledge');
    const cleanup = () => okBtn.removeEventListener('click', onOkClick);

    okBtn.addEventListener('click', onOkClick);
    app.openModal(modal, { initialFocus: okBtn, onClose: cleanup });
  };

  app.updateStatusBar = function() {
    if (!app.state) return;
    const canTranspose = app.state.sections.length > 0;
    ['btn-transpose-up', 'btn-transpose-down'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = !canTranspose;
    });
    const secEl = document.getElementById('status-sections');
    const keyEl = document.getElementById('status-key');
    if (secEl) secEl.textContent = `${app.state.sections.length} section${app.state.sections.length !== 1 ? 's' : ''}`;
    if (keyEl) keyEl.textContent = app.state.key ? `Key: ${app.state.key}` : '-';
    app.updateLibrarySaveStatus();
  };

  // While "Notes, original key & private info" is closed, say what's inside
  // so filled-in details are never invisible.
  app.updateChartDetailsHint = function() {
    const hint = document.getElementById('chart-details-hint');
    if (!hint || !app.state) return;
    const parts = [];
    if (app.state.originalKey) parts.push(`original ${app.canonicalKey ? app.canonicalKey(app.state.originalKey) : app.state.originalKey}`);
    if (app.state.arrangementNotes) parts.push('notes');
    if (app.state.groupId && app.getGroupName) parts.push(app.getGroupName(app.state.groupId));
    if (app.state.status) parts.push(app.state.status);
    if (app.state.source || app.state.infoNotes) parts.push('private notes');
    const text = parts.length ? `· ${parts.join(', ')}` : '';
    if (hint.textContent !== text) hint.textContent = text;
  };

  // Persistent "how far from the original key" readout next to Transpose.
  app.describeTransposeOffset = function(state = app.state) {
    if (!state || !state.key) return '';
    if (!state.originalKey) return '';
    const offset = app.keyOffset ? app.keyOffset(state.originalKey, state.key) : null;
    if (offset === null) return '';
    if (offset === 0) return 'Original key';
    return `${offset > 0 ? '+' : '−'}${Math.abs(offset)} from ${app.canonicalKey(state.originalKey)}`;
  };

  app.updateTransposeStatus = function() {
    const display = document.getElementById('transpose-display');
    if (!display) return;
    const text = app.describeTransposeOffset();
    display.textContent = text;
    display.hidden = !text;
    const reset = document.getElementById('btn-transpose-reset');
    if (reset) {
      const offset = app.state.originalKey && app.state.key && app.keyOffset
        ? app.keyOffset(app.state.originalKey, app.state.key)
        : null;
      reset.hidden = !offset;
    }
  };

  // The draft autosave is crash recovery, not something to manage: its status
  // only shows when it fails.
  app.updateAutoSaveStatus = function(text, state) {
    const el = document.getElementById('status-autosave');
    if (!el) return;
    // Rewriting identical text makes screen readers repeat the live region.
    if (el.textContent !== text) el.textContent = text;
    if (state) el.dataset.saveState = state;
    el.hidden = state !== 'failed';
  };

  app.updateLibrarySaveStatus = function() {
    const el = document.getElementById('status-library');
    if (!el || !app.getLibrarySaveState) return;
    const state = app.getLibrarySaveState();
    const labels = {
      unsaved: 'Not in Library yet',
      pending: 'Unsaved changes',
      saved: 'Saved to Library'
    };
    const syncFailed = state === 'saved' && app.folderSyncError?.chartId === app.state.id;
    el.textContent = syncFailed ? `${labels.saved} · folder sync failed` : labels[state];
    el.dataset.saveState = syncFailed ? 'sync-failed' : state;
    el.title = state === 'saved'
      ? 'Your current chart matches the copy in Library.'
      : 'Your work is kept on this device. Choose Save to Library (Cmd+S) to update the Library copy.';
  };

  app.syncFormFromState = function() {
    document.getElementById('input-title').value = app.state.title || '';
    document.getElementById('input-artist').value = app.state.artist || '';
    document.getElementById('input-bpm').value = app.state.bpm || '';
    document.getElementById('input-timesig').value = app.state.timeSignature || '';
    const canonical = app.canonicalKey || (key => key || '');
    document.getElementById('input-key').value = canonical(app.state.key);
    document.getElementById('input-original-key').value = canonical(app.state.originalKey);
    if (app.updateTransposeStatus) app.updateTransposeStatus();
    document.getElementById('input-capo').value = app.state.capo || '';
    document.getElementById('input-notes').value = app.state.arrangementNotes || '';
    const groupInput = document.getElementById('input-group');
    const statusInput = document.getElementById('input-status');
    const sourceInput = document.getElementById('input-source');
    const infoNotesInput = document.getElementById('input-info-notes');
    if (groupInput) groupInput.value = app.state.groupId || '';
    if (statusInput) statusInput.value = app.state.status || '';
    if (sourceInput) sourceInput.value = app.state.source || '';
    if (infoNotesInput) infoNotesInput.value = app.state.infoNotes || '';
    app.updateChartDetailsHint();
  };

  // ----- Find & replace -------------------------------------------------

  const CHORD_TERM_RE = /^[A-G][#b]?(?:maj|min|m|dim|aug|sus|add|M)?[0-9]*(?:\/[A-G][#b]?)?$/;
  let searchScopeTouched = false;
  let searchMatches = [];
  let searchCurrent = -1;

  function readSearchOptions() {
    return {
      searchStr: document.getElementById('search-find-input')?.value || '',
      replaceStr: document.getElementById('search-replace-input')?.value || '',
      isRegex: !!document.getElementById('search-regex')?.checked,
      matchCase: !!document.getElementById('search-case-sensitive')?.checked,
      scope: document.getElementById('search-scope')?.value || 'all'
    };
  }

  // Returns a global RegExp, null for an empty search, or false when the
  // user's regular expression is invalid. Plain chord searches match whole
  // chord tokens, so "Am" never matches inside "Am7" or a lyric.
  app.buildSearchRegex = function(options = readSearchOptions()) {
    if (!options.searchStr) return null;
    const flags = options.matchCase ? 'g' : 'gi';
    try {
      if (options.isRegex) return new RegExp(options.searchStr, flags);
      const escaped = options.searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (options.scope === 'chords') {
        return new RegExp(`(?<![^\\s|/(\\[])${escaped}(?![^\\s|/)\\]])`, flags);
      }
      return new RegExp(escaped, flags);
    } catch (e) {
      return false;
    }
  };

  // Every editable text field in the chart, tagged chords or lyrics.
  app.getSearchFields = function(scope = 'all') {
    const fields = [];
    app.state.sections.forEach(section => {
      section.lines.forEach(line => {
        if (line.type === 'grid' && line.chords) {
          fields.push({ section, line, property: 'chords', kind: 'chords' });
        }
        if (line.content) {
          fields.push({ section, line, property: 'content', kind: line.type === 'chord' ? 'chords' : 'lyrics' });
        }
      });
    });
    return scope === 'all' ? fields : fields.filter(field => field.kind === scope);
  };

  function countMatches(regex, value) {
    return Array.from(value.matchAll(new RegExp(regex.source, regex.flags))).filter(match => match[0] !== '').length;
  }

  function editorInputFor(field) {
    const key = field.property === 'chords' ? 'chords' : 'content';
    return Array.from(document.querySelectorAll(`[data-focus-key="${key}"]`))
      .find(element => element.dataset.lineId === field.line.id) || null;
  }

  function setSearchCount(text) {
    const count = document.getElementById('search-count');
    if (count && count.textContent !== text) count.textContent = text;
  }

  // Mark matching editor fields and report the count; keeps the current
  // match if it still exists.
  app.updateSearchResults = function() {
    document.querySelectorAll('.line-input.search-match, .line-input.search-current').forEach(element => {
      element.classList.remove('search-match', 'search-current');
    });
    searchMatches = [];
    const options = readSearchOptions();
    const regex = app.buildSearchRegex(options);
    if (regex === null) {
      searchCurrent = -1;
      setSearchCount('');
      return;
    }
    if (regex === false) {
      searchCurrent = -1;
      setSearchCount('Invalid pattern');
      return;
    }
    app.getSearchFields(options.scope).forEach(field => {
      const occurrences = countMatches(regex, field.line[field.property] || '');
      for (let index = 0; index < occurrences; index += 1) searchMatches.push({ field, index });
      if (occurrences) editorInputFor(field)?.classList.add('search-match');
    });
    if (!searchMatches.length) {
      searchCurrent = -1;
      setSearchCount('No matches');
      return;
    }
    if (searchCurrent >= searchMatches.length) searchCurrent = -1;
    if (searchCurrent >= 0) {
      editorInputFor(searchMatches[searchCurrent].field)?.classList.add('search-current');
      setSearchCount(`${searchCurrent + 1} of ${searchMatches.length}`);
    } else {
      setSearchCount(`${searchMatches.length} ${searchMatches.length === 1 ? 'match' : 'matches'}`);
    }
  };

  // Step through matches without taking focus from the Find field.
  app.goToSearchMatch = function(direction = 1) {
    app.updateSearchResults();
    if (!searchMatches.length) return;
    searchCurrent = searchCurrent < 0
      ? (direction > 0 ? 0 : searchMatches.length - 1)
      : (searchCurrent + direction + searchMatches.length) % searchMatches.length;
    const { field } = searchMatches[searchCurrent];
    if (field.section.collapsed && app.toggleSectionCollapse) app.toggleSectionCollapse(field.section.id);
    app.updateSearchResults();
    editorInputFor(field)?.scrollIntoView?.({ behavior: app.scrollBehavior ? app.scrollBehavior() : 'auto', block: 'center' });
  };

  app.searchAndReplace = function() {
    const options = readSearchOptions();
    if (!options.searchStr) {
      app.showToast('Please enter search text', 'error');
      return;
    }

    const regex = app.buildSearchRegex(options);
    if (!regex) {
      app.showToast('Invalid regex', 'error');
      return;
    }

    const fields = app.getSearchFields(options.scope);
    const count = fields.reduce((total, field) => total + countMatches(regex, field.line[field.property] || ''), 0);

    if (!count) {
      app.showToast('No matches found', 'info');
      return;
    }

    app.pushUndo();
    fields.forEach(field => {
      field.line[field.property] = field.line[field.property].replace(new RegExp(regex.source, regex.flags), options.replaceStr);
    });
    app.commitChange();
    searchCurrent = -1;
    if (app.isSearchReplaceOpen()) app.updateSearchResults();
    app.showToast(`Replaced ${count} ${count === 1 ? 'occurrence' : 'occurrences'}`, 'success', { undo: true });
  };

  let searchContext = null;

  app.setReplaceVisible = function(visible) {
    const row = document.getElementById('search-replace-row');
    const toggle = document.getElementById('search-replace-toggle');
    if (row) row.hidden = !visible;
    if (toggle) toggle.setAttribute('aria-expanded', String(visible));
  };

  app.openSearchReplace = function(focusMode = 'find') {
    const bar = document.getElementById('search-replace-bar');
    if (!bar) return;
    if (bar.hidden || !searchContext) {
      searchContext = {
        opener: document.activeElement,
        workspace: app.activeWorkspace,
        panel: document.getElementById('editor-view')?.dataset.panel || 'editor'
      };
      searchScopeTouched = false;
    }
    if (app.showWorkspace) app.showWorkspace('editor');
    if (app.showWorkspacePanel) app.showWorkspacePanel('editor');
    bar.hidden = false;
    if (focusMode === 'replace') app.setReplaceVisible(true);
    const target = focusMode === 'replace'
      ? document.getElementById('search-replace-input')
      : document.getElementById('search-find-input');
    target?.focus();
    target?.select?.();
    if (app.updateSearchResults) app.updateSearchResults();
  };

  app.closeSearchReplace = function(options = {}) {
    const bar = document.getElementById('search-replace-bar');
    if (!bar) return;
    bar.hidden = true;
    app.clearSearchHighlight();
    document.querySelectorAll('.line-input.search-match, .line-input.search-current').forEach(element => {
      element.classList.remove('search-match', 'search-current');
    });
    searchMatches = [];
    searchCurrent = -1;
    const context = searchContext;
    searchContext = null;
    if (options.restore === false) return;
    if (context?.workspace && app.showWorkspace) app.showWorkspace(context.workspace);
    if (context?.panel && app.showWorkspacePanel) app.showWorkspacePanel(context.panel);
    if (context?.opener && typeof context.opener.focus === 'function') context.opener.focus();
  };

  app.isSearchReplaceOpen = function() {
    const bar = document.getElementById('search-replace-bar');
    return !!bar && !bar.hidden;
  };

  // Typing a chord name narrows the search to chords until the user picks a
  // scope themselves.
  app.onSearchInput = function() {
    const options = readSearchOptions();
    const scope = document.getElementById('search-scope');
    if (scope && !searchScopeTouched && !options.isRegex) {
      scope.value = CHORD_TERM_RE.test(options.searchStr.trim()) ? 'chords' : 'all';
    }
    searchCurrent = -1;
    app.updateSearchResults();
    app.highlightSearchPreview();
  };

  app.onSearchScopeChange = function() {
    searchScopeTouched = true;
    searchCurrent = -1;
    app.updateSearchResults();
    app.highlightSearchPreview();
  };

  // Chord rows in the preview carry .chart-chord-line; scope by that.
  function searchNodeInScope(textNode, scope) {
    if (scope === 'all') return true;
    const isChord = !!textNode.parentNode?.closest?.('.chart-chord-line');
    return scope === 'chords' ? isChord : !isChord;
  }

  app.clearSearchHighlight = function() {
    if (app.renderPreview) app.renderPreview();
  };

  app.highlightSearchPreview = function() {
    const searchStr = document.getElementById('search-find-input').value;
    const isRegex = document.getElementById('search-regex').checked;
    const matchCase = document.getElementById('search-case-sensitive').checked;
    const scope = document.getElementById('search-scope')?.value || 'all';

    if (!searchStr) {
      app.clearSearchHighlight();
      return;
    }

    app.renderPreview(); // reset
    const paper = document.getElementById('chart-paper');
    if (!paper) return;

    const regex = app.buildSearchRegex({ searchStr, isRegex, matchCase, scope });
    if (!regex) return;

    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.className === 'search-highlight') continue;
      if (!searchNodeInScope(node, scope)) continue;
      regex.lastIndex = 0;
      if (regex.test(node.nodeValue)) nodesToReplace.push(node);
    }

    nodesToReplace.forEach(textNode => {
      const fragment = document.createDocumentFragment();
      const text = textNode.nodeValue;
      const matcher = new RegExp(regex.source, regex.flags);
      let lastIndex = 0;
      let match;

      while ((match = matcher.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const highlight = document.createElement('span');
        highlight.className = 'search-highlight';
        highlight.textContent = match[0];
        fragment.appendChild(highlight);
        lastIndex = match.index + match[0].length;
        if (match[0] === '') matcher.lastIndex += 1;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  };

})(window.ChartApp = window.ChartApp || {});
