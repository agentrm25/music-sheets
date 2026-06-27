(function(app) {
  'use strict';

  app.commitChange = function() {
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

    if (type === 'success' && message.includes('saved')) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-action-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.onclick = () => {
        app.undo();
        toast.classList.add('fadeout');
        setTimeout(() => toast.remove(), 300);
      };
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  app.showConfirm = function(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    document.getElementById('confirm-message').textContent = message;
    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    const cleanup = () => {
      modal.style.display = 'none';
      cancelBtn.removeEventListener('click', onCancelClick);
      okBtn.removeEventListener('click', onOkClick);
    };

    const onCancelClick = () => cleanup();
    const onOkClick = () => {
      cleanup();
      onConfirm();
    };

    cancelBtn.addEventListener('click', onCancelClick);
    okBtn.addEventListener('click', onOkClick);
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
      content.onclick = () => {
        if (app.state.sections.length > 0 && (!app.state.id || app.state.id !== chart.data.id)) {
          app.showConfirm('Load chart? Unsaved changes to current chart will be lost.', () => {
            app.loadChartFromLibrary(chart.data.id);
          });
        } else {
          app.loadChartFromLibrary(chart.data.id);
        }
      };
      
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

    let count = 0;
    app.pushUndo();

    app.state.sections.forEach(s => {
      s.lines.forEach(l => {
        if (l.content && regex.test(l.content)) {
          l.content = l.content.replace(regex, replaceStr);
          count++;
        }
        if (l.type === 'grid' && l.chords && regex.test(l.chords)) {
          l.chords = l.chords.replace(regex, replaceStr);
          count++;
        }
      });
    });

    if (count > 0) {
      app.commitChange();
      app.showToast(`Replaced ${count} occurrences`, 'success');
    } else {
      app.showToast('No matches found', 'info');
    }
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
        regex = new RegExp(`(${searchStr})`, flags);
      } else {
        const escapedSearch = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        regex = new RegExp(`(${escapedSearch})`, flags);
      }
    } catch (e) {
      return;
    }

    const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.className === 'search-highlight') continue;
      if (regex.test(node.nodeValue)) nodesToReplace.push(node);
    }

    nodesToReplace.forEach(n => {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = n.nodeValue.replace(regex, '<span class="search-highlight">$1</span>');
      n.parentNode.replaceChild(wrapper, n);
    });
  };

})(window.ChartApp = window.ChartApp || {});
