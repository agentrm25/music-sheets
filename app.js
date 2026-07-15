(function(app) {
  'use strict';

  // State
  app.state = app.createEmptyChart();
  app.previewZoom = 60;
  
  // Undo system
  const undoManager = new app.UndoManager(50, (canUndo, canRedo) => {
    const btnU = document.getElementById('btn-undo');
    const btnR = document.getElementById('btn-redo');
    if (btnU) btnU.disabled = !canUndo;
    if (btnR) btnR.disabled = !canRedo;
  });

  app.pushUndo = () => undoManager.push(app.state);
  app.snapshotTextEdit = () => undoManager.snapshotTextEdit(app.state);
  app.commitTextEdit = () => undoManager.commitTextEdit(app.state);
  app.refreshUndoState = () => undoManager.refresh(app.state);
  
  app.undo = () => {
    const snap = undoManager.undo(app.state);
    if (snap) {
      app.state = snap;
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
      app.state = snap;
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
    populateTemplates();
    
    // Load from storage or start fresh
    if (!app.autoLoad()) {
      app.state = app.createEmptyChart();
      app.state.sections.push(app.createSection('intro'));
      app.state.sections.push(app.createSection('verse'));
      app.state.sections.push(app.createSection('chorus'));
    }

    if (app.applyTheme && app.getSettings) app.applyTheme(app.getSettings().theme);
    
    if (app.syncFormFromState) app.syncFormFromState();
    if (app.renderEditor) app.renderEditor();
    if (app.renderPreview) app.renderPreview();
    if (app.renderSavedCharts) app.renderSavedCharts();
    if (app.renderInfoPanel) app.renderInfoPanel();
    if (app.renderCollectedSections) app.renderCollectedSections();
    if (app.renderVersions) app.renderVersions();
    if (app.showEditorTab) app.showEditorTab('sections');
    if (app.showWorkspace) app.showWorkspace('editor');
    
    undoManager.clear();
    app.pushUndo(); // Set initial undo state
  }

  function bindEvents() {
    // Toolbar
    document.getElementById('btn-new').addEventListener('click', () => {
      app.showConfirm('Create a new chart? Unsaved changes will be lost.', () => {
        app.pushUndo();
        app.state = app.createEmptyChart();
        app.state.sections.push(app.createSection('intro'));
        app.state.sections.push(app.createSection('verse'));
        app.state.sections.push(app.createSection('chorus'));
        app.syncFormFromState();
        app.commitChange();
        undoManager.clear();
      });
    });

    document.getElementById('btn-save-library').addEventListener('click', () => app.saveChartToLibrary());
    document.getElementById('btn-export-json').addEventListener('click', () => app.exportJSON());
    document.getElementById('btn-export-pdf').addEventListener('click', () => app.exportPDF());
    document.getElementById('btn-settings').addEventListener('click', () => app.openSettings());
    
    document.getElementById('btn-load').addEventListener('click', () => {
      document.getElementById('file-input-json').click();
    });
    document.getElementById('file-input-json').addEventListener('change', e => {
      if (e.target.files.length) {
        app.importJSON(e.target.files[0]);
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
        if (id === 'key') {
          if (!app.state.originalKey && el.value) {
            app.state.originalKey = el.value;
            const originalKeyInput = document.getElementById('input-original-key');
            if (originalKeyInput) originalKeyInput.value = el.value;
          }
        }
        app.renderPreview();
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

    // Search and Replace
    const srBtn = document.getElementById('search-replace-btn');
    if (srBtn) srBtn.addEventListener('click', () => app.searchAndReplace());
    const srClose = document.getElementById('search-close-btn');
    if (srClose) srClose.addEventListener('click', () => app.closeSearchReplace ? app.closeSearchReplace() : null);
    const srFind = document.getElementById('search-find-input');
    if (srFind) srFind.addEventListener('input', () => app.highlightSearchPreview ? app.highlightSearchPreview() : null);
    const srRegex = document.getElementById('search-regex');
    if (srRegex) srRegex.addEventListener('change', () => app.highlightSearchPreview ? app.highlightSearchPreview() : null);
    const srCase = document.getElementById('search-case-sensitive');
    if (srCase) srCase.addEventListener('change', () => app.highlightSearchPreview ? app.highlightSearchPreview() : null);

    // Editor Sections Toolbar
    document.getElementById('btn-add-section-top').addEventListener('click', () => {
      app.pushUndo();
      const sel = document.getElementById('template-select');
      const tmpl = app.SECTION_TEMPLATES[sel.selectedIndex];
      const sec = app.createSection(tmpl.name.toLowerCase().includes('verse') ? 'verse' : 'custom', app.state.sections);
      if (sec.type === 'custom') {
        const customType = Object.keys(app.SECTION_META).find(k => tmpl.name.toLowerCase().includes(k));
        if (customType) sec.type = customType;
        else sec.customLabel = tmpl.name.split(' ')[0];
      }
      sec.lines = tmpl.lines();
      app.state.sections.unshift(sec);
      app.commitChange();
      const editorSections = document.getElementById('editor-sections');
      editorSections.scrollTo(0, 0);
    });

    document.getElementById('btn-add-section-bottom').addEventListener('click', () => {
      app.pushUndo();
      const sel = document.getElementById('template-select');
      const tmpl = app.SECTION_TEMPLATES[sel.selectedIndex];
      const sec = app.createSection(tmpl.name.toLowerCase().includes('verse') ? 'verse' : 'custom', app.state.sections);
      if (sec.type === 'custom') {
        const customType = Object.keys(app.SECTION_META).find(k => tmpl.name.toLowerCase().includes(k));
        if (customType) sec.type = customType;
        else sec.customLabel = tmpl.name.split(' ')[0];
      }
      sec.lines = tmpl.lines();
      app.state.sections.push(sec);
      app.commitChange();
      setTimeout(() => {
        const cards = document.querySelectorAll('.section-card');
        if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' });
      }, 50);
    });

    document.getElementById('btn-import-text').addEventListener('click', () => {
      document.getElementById('import-textarea').value = '';
      app.openModal('import-modal', { initialFocus: document.getElementById('import-textarea') });
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
        app.showToast(`Imported ${newSections.length} sections`, 'success');
        setTimeout(() => {
          const cards = document.querySelectorAll('.section-card');
          if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    });

    // Preview Tools
    document.getElementById('btn-dark-mode').addEventListener('click', () => {
      const currentTheme = app.getSettings().theme;
      app.setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      if (app.previewZoom < 200) {
        app.previewZoom += 10;
        document.getElementById('zoom-level').textContent = app.previewZoom + '%';
        app.applyZoom();
        app.renderPreview(); // Re-render for page breaks
      }
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      if (app.previewZoom > 50) {
        app.previewZoom -= 10;
        document.getElementById('zoom-level').textContent = app.previewZoom + '%';
        app.applyZoom();
        app.renderPreview(); // Re-render for page breaks
      }
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
        app.saveChartToLibrary();
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
        if ((!app.hasOpenModal || !app.hasOpenModal()) && searchBar && searchBar.style.display !== 'none') {
          app.closeSearchReplace();
        }
      }
    });

    // Library Sort/Search
    const libSearch = document.getElementById('library-search');
    if (libSearch) libSearch.addEventListener('input', () => app.renderSavedCharts());
    const libSort = document.getElementById('library-sort');
    if (libSort) libSort.addEventListener('change', () => app.renderSavedCharts());
  }

  function populateTemplates() {
    const sel = document.getElementById('template-select');
    if (!sel) return;
    app.SECTION_TEMPLATES.forEach((tmpl, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = tmpl.name;
      sel.appendChild(opt);
    });
  }

  function transposeAll(semitones) {
    if (!app.state.sections.length) return;
    app.pushUndo();

    let newKey = app.state.key;
    let useFlats = false;

    if (app.state.key) {
      useFlats = app.determineUseFlats(app.state.key);
      newKey = app.transposeNote(app.state.key, semitones, useFlats);
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

    const display = document.getElementById('transpose-display');
    if (display) {
      const current = parseInt(display.dataset.steps || '0');
      const next = current + semitones;
      display.dataset.steps = next;
      display.textContent = (next > 0 ? '+' : '') + next;
      setTimeout(() => {
        display.textContent = '-';
        display.dataset.steps = 0;
      }, 1500);
    }

    app.syncFormFromState();
    app.commitChange();
    app.showToast('Transposed chart', 'info');
  }

  app.toggleSectionCollapse = function(id) {
    app.pushUndo();
    const sec = app.state.sections.find(s => s.id === id);
    if (sec) {
      sec.collapsed = !sec.collapsed;
      app.commitChange();
    }
  };

  // Init
  document.addEventListener('DOMContentLoaded', init);

})(window.ChartApp = window.ChartApp || {});
