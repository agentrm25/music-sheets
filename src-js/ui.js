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
  const TOAST_FADE_MS = 300;
  const TOAST_ICONS = { success: 'check', error: 'alert', info: 'info' };

  app.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Errors interrupt; everything else rides the container's polite region.
    if (type === 'error') toast.setAttribute('role', 'alert');
    toast.appendChild(app.icon(TOAST_ICONS[type] || TOAST_ICONS.info));
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);
    container.appendChild(toast);

    // Hovering or focusing a toast pauses its countdown so it can be read.
    let remaining = TOAST_DURATION_MS;
    let startedAt = Date.now();
    let timer = null;
    const dismiss = () => {
      toast.classList.add('fadeout');
      setTimeout(() => toast.remove(), TOAST_FADE_MS);
    };
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
  app.bindModalBackdrops = function() {
    document.addEventListener('click', event => {
      const overlay = event.target;
      if (!overlay?.classList?.contains('modal-overlay')) return;
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

  app.updateAutoSaveStatus = function(text, state) {
    const el = document.getElementById('status-autosave');
    if (!el) return;
    // Rewriting identical text makes screen readers repeat the live region.
    if (el.textContent !== text) el.textContent = text;
    if (state) el.dataset.saveState = state;
  };

  app.updateLibrarySaveStatus = function() {
    const el = document.getElementById('status-library');
    if (!el || !app.getLibrarySaveState) return;
    const state = app.getLibrarySaveState();
    const labels = {
      unsaved: 'Not saved to Library',
      pending: 'Library changes pending',
      saved: 'Saved to Library'
    };
    const syncFailed = state === 'saved' && Boolean(app.folderSyncError);
    el.textContent = syncFailed ? `${labels.saved} · folder sync failed` : labels[state];
    el.dataset.saveState = syncFailed ? 'sync-failed' : state;
    el.title = state === 'saved'
      ? 'Your current chart matches the copy in Library.'
      : 'Choose Save to Library to keep the current chart in your Library.';
  };

  const RECENT_CHART_LIMIT = 5;

  // Sidebar "Recent" list: a shortcut to the newest charts. Browsing, sorting,
  // favorites and deletion live in the Library view.
  app.renderSavedCharts = function() {
    const list = document.getElementById('recent-charts-list');
    if (!list) return;

    const recent = app.getSavedCharts()
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
      .slice(0, RECENT_CHART_LIMIT);

    list.innerHTML = '';
    const empty = document.getElementById('recent-charts-empty');
    if (empty) empty.hidden = recent.length > 0;

    recent.forEach(chart => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-chart';
      button.setAttribute('aria-label', `Open ${chart.name}`);
      button.addEventListener('click', () => app.requestLoadChartFromLibrary(chart.data.id));

      const title = document.createElement('span');
      title.className = 'recent-chart-title';
      title.textContent = chart.name;

      const meta = document.createElement('span');
      meta.className = 'recent-chart-meta';
      const savedOn = new Date(chart.savedAt).toLocaleDateString();
      meta.textContent = chart.key ? `${chart.key} · ${savedOn}` : savedOn;

      button.appendChild(title);
      button.appendChild(meta);
      item.appendChild(button);
      list.appendChild(item);
    });
  };

  app.syncFormFromState = function() {
    document.getElementById('input-title').value = app.state.title || '';
    document.getElementById('input-artist').value = app.state.artist || '';
    document.getElementById('input-bpm').value = app.state.bpm || '';
    document.getElementById('input-timesig').value = app.state.timeSignature || '';
    document.getElementById('input-key').value = app.state.key || '';
    document.getElementById('input-original-key').value = app.state.originalKey || '';
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
  };

  app.searchAndReplace = function() {
    const searchStr = document.getElementById('search-find-input').value;
    const replaceStr = document.getElementById('search-replace-input').value;
    const isRegex = document.getElementById('search-regex').checked;
    const matchCase = document.getElementById('search-case-sensitive').checked;

    if (!searchStr) {
      app.showToast('Please enter search text', 'error');
      return;
    }

    let regex;
    try {
      const flags = matchCase ? 'g' : 'gi';
      if (isRegex) {
        regex = new RegExp(searchStr, flags);
      } else {
        const escapedSearch = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        regex = new RegExp(escapedSearch, flags);
      }
    } catch (e) {
      app.showToast('Invalid regex', 'error');
      return;
    }

    const fields = [];
    app.state.sections.forEach(s => {
      s.lines.forEach(l => {
        if (l.content) fields.push({ target: l, property: 'content', value: l.content });
        if (l.type === 'grid' && l.chords) fields.push({ target: l, property: 'chords', value: l.chords });
      });
    });

    const count = fields.reduce((total, field) => {
      const countingRegex = new RegExp(regex.source, regex.flags);
      return total + Array.from(field.value.matchAll(countingRegex)).length;
    }, 0);

    if (!count) {
      app.showToast('No matches found', 'info');
      return;
    }

    app.pushUndo();
    fields.forEach(field => {
      field.target[field.property] = field.value.replace(new RegExp(regex.source, regex.flags), replaceStr);
    });
    app.commitChange();
    app.showToast(`Replaced ${count} ${count === 1 ? 'occurrence' : 'occurrences'}`, 'success');
  };

  let searchContext = null;

  app.openSearchReplace = function(focusMode = 'find') {
    const bar = document.getElementById('search-replace-bar');
    if (!bar) return;
    if (bar.hidden || !searchContext) {
      searchContext = {
        opener: document.activeElement,
        workspace: app.activeWorkspace,
        editorTab: app.activeEditorTab,
        panel: document.getElementById('editor-view')?.dataset.panel || 'editor'
      };
    }
    if (app.showWorkspace) app.showWorkspace('editor');
    if (app.showEditorTab) app.showEditorTab('sections');
    if (app.showWorkspacePanel) app.showWorkspacePanel('editor');
    bar.hidden = false;
    const target = focusMode === 'replace'
      ? document.getElementById('search-replace-input')
      : document.getElementById('search-find-input');
    target?.focus();
  };

  app.closeSearchReplace = function(options = {}) {
    const bar = document.getElementById('search-replace-bar');
    if (!bar) return;
    bar.hidden = true;
    app.clearSearchHighlight();
    const context = searchContext;
    searchContext = null;
    if (options.restore === false) return;
    if (context?.editorTab && app.showEditorTab) app.showEditorTab(context.editorTab);
    if (context?.workspace && app.showWorkspace) app.showWorkspace(context.workspace);
    if (context?.panel && app.showWorkspacePanel) app.showWorkspacePanel(context.panel);
    if (context?.opener && typeof context.opener.focus === 'function') context.opener.focus();
  };

  app.isSearchReplaceOpen = function() {
    const bar = document.getElementById('search-replace-bar');
    return !!bar && !bar.hidden;
  };

  app.clearSearchHighlight = function() {
    if (app.renderPreview) app.renderPreview();
  };

  app.highlightSearchPreview = function() {
    const searchStr = document.getElementById('search-find-input').value;
    const isRegex = document.getElementById('search-regex').checked;
    const matchCase = document.getElementById('search-case-sensitive').checked;

    if (!searchStr) {
      app.clearSearchHighlight();
      return;
    }

    app.renderPreview(); // reset
    const paper = document.getElementById('chart-paper');
    if (!paper) return;

    let regex;
    try {
      const flags = matchCase ? 'g' : 'gi';
      if (isRegex) {
        regex = new RegExp(searchStr, flags);
      } else {
        const escapedSearch = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        regex = new RegExp(escapedSearch, flags);
      }
    } catch (e) {
      return;
    }

    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.className === 'search-highlight') continue;
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
