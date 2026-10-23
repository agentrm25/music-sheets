(function(app) {
  'use strict';

  // State
  app.state = app.createEmptyChart();
  app.previewZoom = 60;
  app.previewAutoFit = true;
  
  // Undo system
  const undoManager = new app.UndoManager(50, (canUndo, canRedo) => {
    const btnU = document.getElementById('btn-undo');
    const btnR = document.getElementById('btn-redo');
    if (btnU) btnU.disabled = !canUndo;
    if (btnR) btnR.disabled = !canRedo;
    if (app.expireUndoToasts) app.expireUndoToasts();
  });

  // Collapsing a section or resizing its editor is how you look at the chart,
  // not a change to it, so chart history ignores those fields.
  function historyState(state) {
    if (!state || !Array.isArray(state.sections)) return state;
    return {
      ...state,
      sections: state.sections.map(section => ({ ...section, collapsed: false, editorHeight: '' }))
    };
  }

  // Restored snapshots keep the sections' current view state.
  function withCurrentView(snapshot) {
    const current = new Map((app.state.sections || []).map(section => [section.id, section]));
    snapshot.sections.forEach(section => {
      const live = current.get(section.id);
      section.collapsed = live ? !!live.collapsed : false;
      section.editorHeight = live ? live.editorHeight || '' : '';
    });
    return snapshot;
  }

  app.pushUndo = () => undoManager.push(historyState(app.state));
  app.snapshotTextEdit = () => undoManager.snapshotTextEdit(historyState(app.state));
  app.commitTextEdit = () => undoManager.commitTextEdit(historyState(app.state));
  app.refreshUndoState = () => undoManager.refresh(historyState(app.state));
  app.historyToken = () => `${undoManager.index}:${undoManager.stack.length}`;

  app.undo = () => {
    const snap = undoManager.undo(historyState(app.state));
    if (snap) {
      app.state = withCurrentView(snap);
      if (app.syncFormFromState) app.syncFormFromState();
      if (app.renderEditor) app.renderEditor();
      if (app.renderPreview) app.renderPreview();
      if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
      if (app.autoSave) app.autoSave();
    }
  };

  app.redo = () => {
    const snap = undoManager.redo();
    if (snap) {
      app.state = withCurrentView(snap);
      if (app.syncFormFromState) app.syncFormFromState();
      if (app.renderEditor) app.renderEditor();
      if (app.renderPreview) app.renderPreview();
      if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
      if (app.autoSave) app.autoSave();
    }
  };

  function init() {
    bindEvents();
    if (app.bindWorkflowEvents) app.bindWorkflowEvents();
    if (app.bindWorkspaceEvents) app.bindWorkspaceEvents();
    if (app.bindModalBackdrops) app.bindModalBackdrops();
    
    // Load from storage or start fresh
    if (!app.autoLoad()) {
      app.state = app.createEmptyChart();
    }

    if (app.applyTheme && app.getSettings) app.applyTheme(app.getSettings().theme);
    
    if (app.syncFormFromState) app.syncFormFromState();
    if (app.renderEditor) app.renderEditor();
    if (app.renderPreview) app.renderPreview();
    if (app.renderInfoPanel) app.renderInfoPanel();
    if (app.renderCollectedSections) app.renderCollectedSections();
    if (app.showWorkspace) app.showWorkspace('editor');
    
    undoManager.clear();
    app.pushUndo(); // Set initial undo state
    app.autoSave(true);
  }

  function saveToLibrary() {
    return app.runWithBusyButton('btn-save-library', () => app.saveChartToLibrary());
  }

  function bindEvents() {
    // Toolbar
    document.getElementById('btn-new').addEventListener('click', () => {
      // Starting over clears Undo, so only ask when there is unsaved work.
      const startNewChart = () => {
        app.pushUndo();
        app.state = app.createEmptyChart();
        app.syncFormFromState();
        app.commitChange();
        undoManager.clear();
        if (app.showWorkspace) app.showWorkspace('editor');
        if (app.showWorkspacePanel) app.showWorkspacePanel('editor');
        document.getElementById('input-title')?.focus();
      };
      const hasWork = app.chartHasContent(app.state);
      const isDirty = app.isCurrentChartDirty ? app.isCurrentChartDirty() : true;
      if (hasWork && isDirty) {
        app.showConfirm('Changes that aren’t saved to Library will be lost, and Undo history is cleared.', startNewChart, { title: 'Start a new chart?', confirmLabel: 'New chart' });
      } else {
        startNewChart();
      }
    });

    document.getElementById('btn-save-library').addEventListener('click', saveToLibrary);
    document.getElementById('btn-export-json').addEventListener('click', () => app.exportJSON());
    document.getElementById('btn-export-pdf').addEventListener('click', () => app.exportPDF());
    document.getElementById('btn-export-pdf-menu')?.addEventListener('click', () => app.exportPDF());
    document.getElementById('btn-settings').addEventListener('click', () => app.openSettings());
    
    document.getElementById('btn-load').addEventListener('click', () => app.openImportModal());
    document.getElementById('btn-import-json-file')?.addEventListener('click', () => {
      app.closeModal('import-modal');
      document.getElementById('file-input-json').click();
    });
    document.getElementById('file-input-json').addEventListener('change', e => {
      if (e.target.files.length) {
        app.requestImportJSON(e.target.files[0]);
        e.target.value = ''; // Reset
      }
    });

    document.getElementById('btn-shortcuts').addEventListener('click', () => {
      app.openModal('shortcuts-modal', { initialFocus: document.getElementById('btn-shortcuts-close') });
    });
    document.getElementById('btn-shortcuts-close').addEventListener('click', () => {
      app.closeModal('shortcuts-modal');
    });

    document.getElementById('btn-settings-close').addEventListener('click', () => app.closeSettings());
    document.getElementById('btn-choose-save-folder').addEventListener('click', () => app.chooseSaveDirectory());
    document.getElementById('btn-clear-save-folder').addEventListener('click', () => app.clearSaveDirectory());

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => app.undo());
    document.getElementById('btn-redo').addEventListener('click', () => app.redo());

    // Sidebar inputs
    [
      ['title', 'title'],
      ['artist', 'artist'],
      ['timesig', 'timeSignature'],
      ['key', 'key'],
      ['original-key', 'originalKey'],
      ['capo', 'capo'],
      ['notes', 'arrangementNotes']
    ].forEach(([id, prop]) => {
      const el = document.getElementById(`input-${id}`);
      if (!el) return;
      el.addEventListener('focus', () => app.snapshotTextEdit());
      el.addEventListener('blur', () => app.commitTextEdit());
      el.addEventListener('input', () => {
        app.state[prop] = el.value;
        if (prop === 'key' || prop === 'originalKey') app.updateTransposeStatus();
        if (prop === 'originalKey' || prop === 'arrangementNotes') app.updateChartDetailsHint();
        app.schedulePreview();
        app.autoSave();
      });
    });

    const bpmInput = document.getElementById('input-bpm');
    if (bpmInput) {
      const commitBpm = () => {
        const normalized = app.normalizeBpm(bpmInput.value);
        const normalizedValue = normalized === null ? '' : String(normalized);
        const stateChanged = app.state.bpm !== normalized;
        const inputChanged = bpmInput.value !== normalizedValue;
        if (!stateChanged && !inputChanged) return;

        app.state.bpm = normalized;
        bpmInput.value = normalizedValue;
        if (stateChanged) {
          app.renderPreview();
          app.autoSave();
        }
      };
      bpmInput.addEventListener('focus', () => app.snapshotTextEdit());
      bpmInput.addEventListener('blur', () => {
        commitBpm();
        app.commitTextEdit();
      });
      bpmInput.addEventListener('change', commitBpm);
    }

    // Transpose
    document.getElementById('btn-transpose-up').addEventListener('click', () => transposeAll(1));
    document.getElementById('btn-transpose-down').addEventListener('click', () => transposeAll(-1));
    document.getElementById('btn-transpose-reset')?.addEventListener('click', () => {
      const offset = app.keyOffset(app.state.originalKey, app.state.key);
      if (offset) transposeAll(-offset);
    });

    // Find and replace
    const byId = id => document.getElementById(id);
    byId('btn-find')?.addEventListener('click', () => app.openSearchReplace('find'));
    byId('search-replace-btn')?.addEventListener('click', () => app.searchAndReplace());
    byId('search-close-btn')?.addEventListener('click', () => app.closeSearchReplace());
    const srFind = byId('search-find-input');
    // Skip the debounced update if the bar closed while it was pending.
    srFind?.addEventListener('input', app.debounce(() => {
      if (app.isSearchReplaceOpen?.()) app.onSearchInput();
    }, app.SEARCH_DEBOUNCE_MS));
    srFind?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      app.goToSearchMatch(event.shiftKey ? -1 : 1);
    });
    byId('search-replace-input')?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      app.searchAndReplace();
    });
    byId('search-next-btn')?.addEventListener('click', () => app.goToSearchMatch(1));
    byId('search-prev-btn')?.addEventListener('click', () => app.goToSearchMatch(-1));
    byId('search-scope')?.addEventListener('change', () => app.onSearchScopeChange());
    ['search-regex', 'search-case-sensitive'].forEach(id => byId(id)?.addEventListener('change', () => {
      app.updateSearchResults();
      app.highlightSearchPreview();
    }));
    byId('search-replace-toggle')?.addEventListener('click', () => {
      const showing = byId('search-replace-row')?.hidden === false;
      app.setReplaceVisible(!showing);
      if (!showing) byId('search-replace-input')?.focus();
    });

    // Import: pasted text adds sections; a JSON file replaces the chart.
    app.openImportModal = function(text = '') {
      byId('import-textarea').value = text;
      app.openModal('import-modal', { initialFocus: byId('import-textarea') });
    };
    byId('btn-start-import')?.addEventListener('click', () => app.openImportModal());

    // Dropping a file anywhere imports it the same way.
    document.addEventListener('dragover', event => {
      if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
    });
    document.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        app.requestImportJSON(file);
      } else if (/^text\//.test(file.type) || /\.(txt|text|md|chordpro|cho|crd)$/i.test(file.name)) {
        file.text().then(text => app.openImportModal(text));
      } else {
        app.showToast('Drop a .txt or .json chart file to import it', 'error');
      }
    });

    document.getElementById('btn-import-cancel').addEventListener('click', () => {
      app.closeModal('import-modal');
    });
    
    document.getElementById('btn-import-confirm').addEventListener('click', () => {
      const text = document.getElementById('import-textarea').value;
      if (!text.trim()) {
        app.showToast('Paste chart text before importing', 'error');
        document.getElementById('import-textarea').focus();
        return;
      }
      const newSections = app.parseImportText(text);
      if (newSections.length > 0) {
        app.pushUndo();
        app.state.sections = app.state.sections.concat(newSections);
        app.commitChange();
        app.closeModal('import-modal');
        app.showToast(`Added ${app.pluralize(newSections.length, 'section')}`, 'success', { undo: true });
        if (app.revealSection) app.revealSection(newSections[0].id, { focus: false });
      }
    });

    // Preview Tools
    document.getElementById('btn-dark-mode').addEventListener('click', () => {
      const currentTheme = app.getSettings().theme;
      app.setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });

    const zoomBy = step => {
      const next = Math.max(app.ZOOM_MIN, Math.min(app.ZOOM_MAX, app.previewZoom + step));
      if (next === app.previewZoom) return;
      app.previewAutoFit = false;
      app.previewZoom = next;
      app.renderPreview(); // Re-render for page breaks; also applies the zoom
    };
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoomBy(app.ZOOM_STEP));
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoomBy(-app.ZOOM_STEP));

    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
      app.previewAutoFit = true;
      if (app.fitPreview) app.fitPreview();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', e => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      const modalOpen = app.hasOpenModal && app.hasOpenModal();
      const shortcutKey = e.key.toLowerCase();
      const isAppShortcut = cmd && ['z', 's', 'h', 'f', 'e'].includes(shortcutKey);
      const editableTarget = e.target && (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      );

      if (modalOpen && (isAppShortcut || e.key === '?')) {
        if (isAppShortcut && !(shortcutKey === 'z' && editableTarget)) e.preventDefault();
        return;
      }

      if (cmd && shortcutKey === 'z' && editableTarget) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        app.openModal('shortcuts-modal', { initialFocus: document.getElementById('btn-shortcuts-close') });
      }

      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          app.redo();
        } else {
          app.undo();
        }
      }

      if (cmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveToLibrary();
      }

      if (cmd && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        app.openSearchReplace('replace');
      }

      if (cmd && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        app.openSearchReplace('find');
      }

      if (cmd && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        app.exportPDF();
      }

      if (e.key === 'Escape') {
        const searchBar = document.getElementById('search-replace-bar');
        if ((!app.hasOpenModal || !app.hasOpenModal()) && searchBar && !searchBar.hidden) {
          app.closeSearchReplace();
        }
      }
    });
  }

  function transposeAll(semitones) {
    if (!app.state.sections.length) return;
    app.pushUndo();

    let newKey = app.state.key;
    let useFlats = false;

    if (app.parseKey(app.state.key)) {
      if (!app.state.originalKey) app.state.originalKey = app.canonicalKey(app.state.key);
      newKey = app.transposeKey(app.state.key, semitones);
      app.state.key = newKey;
      useFlats = app.determineUseFlats(newKey);
    } else {
      let firstChord = '';
      for (const section of app.state.sections) {
        for (const line of section.lines) {
          if ((line.type === 'chord' && line.content) || (line.type === 'grid' && line.chords)) {
            const chords = line.type === 'chord' ? line.content : line.chords;
            const match = chords.match(/[A-G][#b]?/);
            if (match) { firstChord = match[0]; break; }
          }
        }
        if (firstChord) break;
      }
      if (firstChord) {
        useFlats = app.determineUseFlats(firstChord);
      }
    }

    app.state.sections.forEach(section => {
      section.lines.forEach(line => {
        if (line.type === 'chord' && line.content) {
          line.content = app.transposeChordLine(line.content, semitones, useFlats);
        } else if (line.type === 'grid' && line.chords) {
          line.chords = app.transposeChordLine(line.chords, semitones, useFlats);
        }
      });
    });

    app.syncFormFromState();
    app.commitChange();
    const direction = semitones > 0 ? 'up' : 'down';
    app.showToast(app.state.key ? `Transposed ${direction} to ${app.state.key}` : `Transposed ${direction} one semitone`, 'info', { undo: true, replace: 'transpose' });
  }

  app.transposeAll = transposeAll;

  // View state only: no Undo step (see historyState).
  app.toggleSectionCollapse = function(id) {
    const sec = app.state.sections.find(s => s.id === id);
    if (sec) {
      sec.collapsed = !sec.collapsed;
      app.commitChange();
    }
  };

  // Init
  document.addEventListener('DOMContentLoaded', init);

})(window.ChartApp = window.ChartApp || {});
