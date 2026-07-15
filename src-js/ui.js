(function(app) {
  'use strict';

  app.commitChange = function() {
    if (app.refreshUndoState) app.refreshUndoState();
    if (app.renderEditor) app.renderEditor();
    if (app.renderPreview) app.renderPreview();
    if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
    if (app.autoSave) app.autoSave();
  };

  app.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : 'ℹ';
    const iconSpan = document.createElement('span');
    iconSpan.style.fontWeight = 'bold';
    iconSpan.textContent = icon;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
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
    modal.style.display = 'flex';
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
    entry.modal.style.display = 'none';
    entry.modal.setAttribute('aria-hidden', 'true');
    if (entry.onClose) entry.onClose(reason);
    if (!modalStack.length) document.removeEventListener('keydown', handleModalKeydown);
    if (entry.opener && typeof entry.opener.focus === 'function') entry.opener.focus();
    return true;
  };

  app.hasOpenModal = function() {
    return modalStack.length > 0;
  };

  app.showConfirm = function(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    document.getElementById('confirm-message').textContent = message;

    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

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
    const secEl = document.getElementById('status-sections');
    const keyEl = document.getElementById('status-key');
    if (secEl) secEl.textContent = `${app.state.sections.length} section${app.state.sections.length !== 1 ? 's' : ''}`;
    if (keyEl) keyEl.textContent = app.state.key ? `Key: ${app.state.key}` : '-';
  };

  app.updateAutoSaveStatus = function(text) {
    const el = document.getElementById('status-autosave');
    if (el) el.textContent = text;
  };

  app.renderSavedCharts = function() {
    const list = document.getElementById('saved-charts-list');
    if (!list) return;

    let charts = app.getSavedCharts();
    const searchInput = document.getElementById('library-search');
    const sortSelect = document.getElementById('library-sort');
    
    if (searchInput && searchInput.value) {
      const q = searchInput.value.toLowerCase();
      charts = charts.filter(c => c.name.toLowerCase().includes(q) || (c.key && c.key.toLowerCase().includes(q)));
    }

    if (sortSelect) {
      const sort = sortSelect.value;
      charts.sort((a, b) => {
        if (sort === 'date') return new Date(b.savedAt) - new Date(a.savedAt);
        if (sort === 'alpha') return a.name.localeCompare(b.name);
        if (sort === 'key') return (a.key || 'Z').localeCompare(b.key || 'Z');
        return 0;
      });
    }

    list.innerHTML = '';
    if (charts.length === 0) {
      list.innerHTML = '<div style="padding: 12px; opacity: 0.5;">No charts found.</div>';
      return;
    }

    charts.forEach(chart => {
      const item = document.createElement('div');
      item.className = 'library-item';
      
      const content = document.createElement('div');
      content.className = 'library-item-content';
      content.setAttribute('role', 'button');
      content.setAttribute('aria-label', `Open ${chart.name}`);
      content.tabIndex = 0;
      const openChart = () => app.requestLoadChartFromLibrary(chart.data.id);
      content.onclick = openChart;
      content.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openChart();
      });
      
      const title = document.createElement('div');
      title.className = 'library-item-title';
      title.textContent = chart.name;
      
      const meta = document.createElement('div');
      meta.className = 'library-item-meta';
      const d = new Date(chart.savedAt);
      meta.textContent = `${chart.key ? chart.key + ' • ' : ''}${d.toLocaleDateString()}`;
      
      content.appendChild(title);
      content.appendChild(meta);
      
      const actions = document.createElement('div');
      actions.className = 'library-item-actions';

      const favBtn = document.createElement('button');
      favBtn.className = `favorite-btn ${chart.isFavorite ? 'favorited' : ''}`;
      favBtn.innerHTML = chart.isFavorite ? '★' : '☆';
      favBtn.title = chart.isFavorite ? 'Remove from favorites' : 'Add to favorites';
      favBtn.setAttribute('aria-label', favBtn.title);
      favBtn.onclick = (e) => {
        e.stopPropagation();
        chart.isFavorite = !chart.isFavorite;
        const all = app.getSavedCharts();
        const idx = all.findIndex(c => c.data.id === chart.data.id);
        if (idx >= 0) {
          all[idx].isFavorite = chart.isFavorite;
          localStorage.setItem('chart-creator-saved', JSON.stringify(all));
          app.renderSavedCharts();
          if (app.renderFullLibrary) app.renderFullLibrary();
        }
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-ghost';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete';
      delBtn.setAttribute('aria-label', `Delete ${chart.name}`);
      delBtn.onclick = (e) => {
        e.stopPropagation();
        app.showConfirm(`Delete "${chart.name}" permanently?`, () => {
          app.deleteChartFromLibrary(chart.data.id);
        });
      };
      
      actions.appendChild(favBtn);
      actions.appendChild(delBtn);

      item.appendChild(content);
      item.appendChild(actions);
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
    if (bar.style.display === 'none' || !searchContext) {
      searchContext = {
        opener: document.activeElement,
        workspace: app.activeWorkspace,
        editorTab: app.activeEditorTab
      };
    }
    if (app.showWorkspace) app.showWorkspace('editor');
    if (app.showEditorTab) app.showEditorTab('sections');
    bar.style.display = 'flex';
    const target = focusMode === 'replace'
      ? document.getElementById('search-replace-input')
      : document.getElementById('search-find-input');
    target?.focus();
  };

  app.closeSearchReplace = function(options = {}) {
    const bar = document.getElementById('search-replace-bar');
    if (!bar) return;
    bar.style.display = 'none';
    app.clearSearchHighlight();
    const context = searchContext;
    searchContext = null;
    if (options.restore === false) return;
    if (context?.editorTab && app.showEditorTab) app.showEditorTab(context.editorTab);
    if (context?.workspace && app.showWorkspace) app.showWorkspace(context.workspace);
    if (context?.opener && typeof context.opener.focus === 'function') context.opener.focus();
  };

  app.isSearchReplaceOpen = function() {
    const bar = document.getElementById('search-replace-bar');
    return !!bar && bar.style.display !== 'none';
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
