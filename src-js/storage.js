(function(app) {
  'use strict';

  const STORAGE_KEY = 'chart-creator-state';
  const STORAGE_CHARTS_KEY = 'chart-creator-saved';
  const STORAGE_SETTINGS_KEY = 'chart-creator-settings';
  const STORAGE_GROUPS_KEY = 'chart-creator-groups';
  const STORAGE_COLLECTED_SECTIONS_KEY = 'chart-creator-collected-sections';

  let autoSaveTimeout = null;

  function getTauriInvoke() {
    return window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke
      ? window.__TAURI__.core.invoke
      : null;
  }

  function getChartFileName(name) {
    const clean = (name || 'Untitled Chart')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    return `${clean || 'Untitled Chart'}.json`;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeVersion(version) {
    if (!version || typeof version !== 'object') return null;
    const data = app.normalizeState(version.data);
    return {
      id: version.id || app.generateId(),
      name: version.name || 'Untitled Version',
      notes: version.notes || '',
      createdAt: version.createdAt || new Date().toISOString(),
      key: version.key || data.key || '',
      sectionsCount: version.sectionsCount !== undefined ? version.sectionsCount : data.sections.length,
      data
    };
  }

  function normalizeSavedChartEntry(entry) {
    const raw = entry && typeof entry === 'object' ? entry : {};
    const data = app.normalizeState(raw.data || {});
    const groupId = raw.groupId || data.groupId || '';
    data.groupId = groupId;
    const versions = Array.isArray(raw.versions)
      ? raw.versions.map(normalizeVersion).filter(Boolean)
      : [];

    return {
      name: raw.name || data.title || 'Untitled Chart',
      data,
      savedAt: raw.savedAt || new Date().toISOString(),
      key: raw.key !== undefined ? raw.key : data.key || '',
      sectionsCount: raw.sectionsCount !== undefined ? raw.sectionsCount : data.sections.length,
      isFavorite: !!raw.isFavorite,
      groupId,
      versions
    };
  }

  function buildEntryFromState(existing) {
    const data = cloneData(app.normalizeState(app.state));
    const groupId = app.state.groupId || '';
    data.groupId = groupId;
    return {
      name: app.state.title || 'Untitled Chart',
      data,
      savedAt: new Date().toISOString(),
      key: app.state.key || '',
      sectionsCount: app.state.sections.length,
      isFavorite: existing ? !!existing.isFavorite : false,
      groupId,
      versions: existing && Array.isArray(existing.versions) ? existing.versions : []
    };
  }

  function saveCharts(charts) {
    localStorage.setItem(STORAGE_CHARTS_KEY, JSON.stringify(charts));
  }

  function refreshLibrarySurfaces() {
    if (app.renderSavedCharts) app.renderSavedCharts();
    if (app.renderFullLibrary) app.renderFullLibrary();
    if (app.renderInfoPanel) app.renderInfoPanel();
    if (app.renderVersions) app.renderVersions();
  }

  function renderFolderStatus(settings) {
    const status = document.getElementById('settings-save-folder-status');
    const folderInput = document.getElementById('settings-save-folder');
    const chooseBtn = document.getElementById('btn-choose-save-folder');
    const clearBtn = document.getElementById('btn-clear-save-folder');
    if (!status || !folderInput || !chooseBtn || !clearBtn) return;

    const nativeAvailable = !!getTauriInvoke();
    folderInput.value = settings.saveDirectory || '';
    chooseBtn.disabled = !nativeAvailable;
    clearBtn.disabled = !settings.saveDirectory;

    if (!nativeAvailable) {
      status.textContent = 'Folder saving is available in the desktop app.';
      status.className = 'settings-status info';
    } else if (settings.saveDirectory) {
      status.textContent = 'Saved songs will also be written as JSON files.';
      status.className = 'settings-status success';
    } else {
      status.textContent = 'Choose a folder to mirror saved songs as JSON files.';
      status.className = 'settings-status info';
    }
  }

  app.getSettings = function() {
    try {
      const data = localStorage.getItem(STORAGE_SETTINGS_KEY);
      return Object.assign({ saveDirectory: '' }, data ? JSON.parse(data) : {});
    } catch {
      return { saveDirectory: '' };
    }
  };

  app.saveSettings = function(settings) {
    const next = Object.assign({ saveDirectory: '' }, settings || {});
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(next));
    app.renderSettings();
  };

  app.renderSettings = function() {
    renderFolderStatus(app.getSettings());
  };

  app.openSettings = function() {
    app.renderSettings();
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'flex';
  };

  app.closeSettings = function() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
  };

  app.chooseSaveDirectory = async function() {
    const invoke = getTauriInvoke();
    if (!invoke) {
      app.showToast('Folder selection is available in the desktop app.', 'info');
      app.renderSettings();
      return;
    }

    try {
      const directory = await invoke('choose_save_directory');
      if (!directory) return;
      app.saveSettings(Object.assign(app.getSettings(), { saveDirectory: directory }));
      app.showToast('Save folder selected', 'success');
    } catch (e) {
      console.error('Choose save folder failed:', e);
      app.showToast('Could not choose save folder', 'error');
    }
  };

  app.clearSaveDirectory = function() {
    app.saveSettings(Object.assign(app.getSettings(), { saveDirectory: '' }));
    app.showToast('Save folder cleared', 'info');
  };

  app.saveChartFileToDirectory = async function(entry) {
    const invoke = getTauriInvoke();
    const settings = app.getSettings();
    if (!invoke || !settings.saveDirectory) return null;

    const fileName = getChartFileName(entry.name);
    const contents = JSON.stringify(entry.data, null, 2);
    return invoke('save_chart_file', {
      directory: settings.saveDirectory,
      fileName,
      contents
    });
  };

  app.autoSave = function(immediate = false) {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

    const doSave = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
        if (app.updateAutoSaveStatus) app.updateAutoSaveStatus('Auto-saved');
      } catch (e) {
        console.warn('Auto-save failed:', e);
        if (app.updateAutoSaveStatus) app.updateAutoSaveStatus('Save failed');
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          app.showToast('Autosave failed: Storage full', 'error');
        }
      }
    };

    if (immediate) {
      doSave();
    } else {
      if (app.updateAutoSaveStatus) app.updateAutoSaveStatus('Saving...');
      autoSaveTimeout = setTimeout(doSave, 500);
    }
  };

  app.autoLoad = function() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        app.state = app.normalizeState(parsed);
        return true;
      }
    } catch (e) {
      console.warn('Auto-load failed:', e);
    }
    return false;
  };

  app.getSavedCharts = function() {
    try {
      const data = localStorage.getItem(STORAGE_CHARTS_KEY);
      const parsed = data ? JSON.parse(data) : [];
      const charts = Array.isArray(parsed) ? parsed.map(normalizeSavedChartEntry) : [];
      try {
        saveCharts(charts);
      } catch (e) {
        console.warn('Failed to save migrated charts:', e);
      }
      return charts;
    } catch {
      return [];
    }
  };

  app.saveCharts = function(charts) {
    saveCharts(charts);
  };

  app.saveChartToLibrary = async function(options = {}) {
    if (!app.state.id) app.state.id = app.generateId();
    const name = app.state.title || 'Untitled Chart';
    const charts = app.getSavedCharts();
    const existing = charts.findIndex(c =>
      (c.data.id && c.data.id === app.state.id) ||
      (!c.data.id && c.name === name)
    );
    const entry = buildEntryFromState(existing >= 0 ? charts[existing] : null);
    if (existing >= 0) {
      charts[existing] = entry;
    } else {
      charts.push(entry);
    }
    try {
      saveCharts(charts);
      refreshLibrarySurfaces();

      try {
        const filePath = await app.saveChartFileToDirectory(entry);
        if (!options.silent) app.showToast(filePath ? `"${name}" saved to folder` : `"${name}" saved`, 'success');
      } catch (fileErr) {
        console.error('Folder save failed:', fileErr);
        if (!options.silent) app.showToast(`"${name}" saved locally; folder save failed`, 'error');
      }
    } catch (e) {
      console.error('Library save failed:', e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        app.showToast('Storage quota exceeded! Export JSON or prune library.', 'error');
        alert('Local storage is full! Please export your chart as JSON or delete older saved charts to free up space.');
      } else {
        app.showToast('Failed to save to library.', 'error');
      }
    }
  };

  app.loadChartFromLibrary = function(id) {
    const charts = app.getSavedCharts();
    const chart = charts.find(c => c.data.id === id);
    if (chart) {
      app.pushUndo();
      app.state = app.normalizeState(chart.data);
      app.state.groupId = chart.groupId || app.state.groupId || '';
      if (!app.state.id) app.state.id = id;
      if (app.syncFormFromState) app.syncFormFromState();
      if (app.renderEditor) app.renderEditor();
      if (app.renderPreview) app.renderPreview();
      if (app.updateStatusBar) app.updateStatusBar();
      if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
      if (app.showWorkspace) app.showWorkspace('editor');
      app.showToast(`Loaded "${chart.name}"`, 'info');
    }
  };

  app.deleteChartFromLibrary = function(id) {
    let charts = app.getSavedCharts();
    const chart = charts.find(c => c.data.id === id);
    const name = chart ? chart.name : 'Chart';
    charts = charts.filter(c => c.data.id !== id);
    try {
      saveCharts(charts);
      refreshLibrarySurfaces();
      app.showToast(`Deleted "${name}"`, 'info');
    } catch (e) {
      console.error('Delete failed:', e);
      app.showToast('Failed to delete chart', 'error');
    }
  };

  app.getGroups = function() {
    try {
      const data = localStorage.getItem(STORAGE_GROUPS_KEY);
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(group => group && typeof group === 'object')
        .map(group => ({
          id: group.id || app.generateId(),
          name: group.name || 'Untitled Group',
          createdAt: group.createdAt || new Date().toISOString(),
          updatedAt: group.updatedAt || group.createdAt || new Date().toISOString()
        }));
    } catch {
      return [];
    }
  };

  app.saveGroups = function(groups) {
    localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(groups));
    if (app.renderGroups) app.renderGroups();
    if (app.renderGroupOptions) app.renderGroupOptions();
    if (app.renderFullLibrary) app.renderFullLibrary();
  };

  app.createGroup = function(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      app.showToast('Enter a group name', 'error');
      return null;
    }
    const groups = app.getGroups();
    const now = new Date().toISOString();
    const group = { id: app.generateId(), name: trimmed, createdAt: now, updatedAt: now };
    groups.push(group);
    app.saveGroups(groups);
    app.showToast(`Created "${trimmed}"`, 'success');
    return group;
  };

  app.renameGroup = function(id, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      app.showToast('Enter a group name', 'error');
      return false;
    }
    const groups = app.getGroups();
    const group = groups.find(g => g.id === id);
    if (!group) return false;
    group.name = trimmed;
    group.updatedAt = new Date().toISOString();
    app.saveGroups(groups);
    app.showToast('Group renamed', 'success');
    return true;
  };

  app.deleteGroup = function(id) {
    const charts = app.getSavedCharts();
    if (charts.some(chart => chart.groupId === id)) {
      app.showToast('Move charts before deleting this group', 'error');
      return false;
    }
    const groups = app.getGroups();
    const next = groups.filter(group => group.id !== id);
    if (app.librarySelectedGroupId === id) app.librarySelectedGroupId = 'all';
    app.saveGroups(next);
    app.showToast('Group deleted', 'info');
    return true;
  };

  app.getGroupName = function(id) {
    if (!id) return 'Ungrouped';
    const group = app.getGroups().find(g => g.id === id);
    return group ? group.name : 'Ungrouped';
  };

  app.updateChartGroup = function(chartId, groupId) {
    const charts = app.getSavedCharts();
    const chart = charts.find(c => c.data.id === chartId);
    if (!chart) return;
    chart.groupId = groupId || '';
    chart.data.groupId = chart.groupId;
    saveCharts(charts);
    if (app.state && app.state.id === chartId) {
      app.state.groupId = chart.groupId;
      app.autoSave(true);
    }
    refreshLibrarySurfaces();
  };

  app.getCollectedSections = function() {
    try {
      const data = localStorage.getItem(STORAGE_COLLECTED_SECTIONS_KEY);
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && typeof item === 'object' && item.section)
        .map(item => ({
          id: item.id || app.generateId(),
          name: item.name || 'Collected Section',
          type: item.type || item.section.type || 'custom',
          sourceChartId: item.sourceChartId || '',
          sourceChartTitle: item.sourceChartTitle || 'Untitled Chart',
          savedAt: item.savedAt || new Date().toISOString(),
          section: item.section
        }));
    } catch {
      return [];
    }
  };

  app.saveCollectedSections = function(items) {
    localStorage.setItem(STORAGE_COLLECTED_SECTIONS_KEY, JSON.stringify(items));
    if (app.renderCollectedSections) app.renderCollectedSections();
  };

  app.saveCollectedSection = function(sectionId, name) {
    const section = app.state.sections.find(s => s.id === sectionId);
    if (!section) return false;
    const trimmed = (name || app.getSectionDisplayTitle(section) || 'Collected Section').trim();
    const items = app.getCollectedSections();
    items.unshift({
      id: app.generateId(),
      name: trimmed,
      type: section.type || 'custom',
      sourceChartId: app.state.id || '',
      sourceChartTitle: app.state.title || 'Untitled Chart',
      savedAt: new Date().toISOString(),
      section: cloneData(section)
    });
    app.saveCollectedSections(items);
    app.showToast(`Collected "${trimmed}"`, 'success');
    return true;
  };

  app.cloneSectionForInsert = function(section) {
    const copy = cloneData(section);
    copy.id = app.generateId();
    copy.collapsed = false;
    if (Array.isArray(copy.lines)) {
      copy.lines.forEach(line => {
        line.id = app.generateId();
      });
    } else {
      copy.lines = [];
    }
    if (copy.type === 'verse') copy.verseNumber = app.getNextVerseNumber(app.state.sections);
    return copy;
  };

  app.insertCollectedSection = function(id) {
    const item = app.getCollectedSections().find(entry => entry.id === id);
    if (!item) return;
    app.pushUndo();
    const copy = app.cloneSectionForInsert(item.section);
    app.state.sections.push(copy);
    app.commitChange();
    app.showToast(`Inserted "${item.name}"`, 'success');
    setTimeout(() => {
      const card = document.querySelector(`[data-section-id="${copy.id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  app.deleteCollectedSection = function(id) {
    const items = app.getCollectedSections();
    const item = items.find(entry => entry.id === id);
    app.saveCollectedSections(items.filter(entry => entry.id !== id));
    app.showToast(item ? `Removed "${item.name}"` : 'Removed section', 'info');
  };

  app.isCurrentChartDirty = function() {
    if (!app.state || !app.state.id) return true;
    const chart = app.getSavedCharts().find(c => c.data.id === app.state.id);
    if (!chart) return true;
    return JSON.stringify(app.normalizeState(app.state)) !== JSON.stringify(app.normalizeState(chart.data));
  };

  app.saveChartVersion = function(name, notes) {
    if (!app.state.id) app.state.id = app.generateId();
    const charts = app.getSavedCharts();
    let idx = charts.findIndex(c => c.data.id === app.state.id);
    const existing = idx >= 0 ? charts[idx] : null;
    const entry = buildEntryFromState(existing);
    const data = cloneData(entry.data);
    const version = {
      id: app.generateId(),
      name: (name || '').trim() || `Version ${entry.versions.length + 1}`,
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString(),
      key: app.state.key || '',
      sectionsCount: app.state.sections.length,
      data
    };
    entry.versions = [version].concat(entry.versions || []);
    if (idx >= 0) {
      charts[idx] = entry;
    } else {
      charts.push(entry);
    }
    saveCharts(charts);
    refreshLibrarySurfaces();
    app.showToast(`Saved "${version.name}"`, 'success');
  };

  app.restoreChartVersion = function(versionId) {
    const chart = app.getSavedCharts().find(c => c.data.id === app.state.id);
    if (!chart) return;
    const version = (chart.versions || []).find(v => v.id === versionId);
    if (!version) return;

    const restore = () => {
      app.pushUndo();
      app.state = app.normalizeState(version.data);
      app.state.groupId = chart.groupId || app.state.groupId || '';
      if (app.syncFormFromState) app.syncFormFromState();
      if (app.renderEditor) app.renderEditor();
      if (app.renderPreview) app.renderPreview();
      if (app.updateStatusBar) app.updateStatusBar();
      if (app.refreshWorkflowPanels) app.refreshWorkflowPanels();
      app.autoSave(true);
      app.showToast(`Restored "${version.name}"`, 'info');
    };

    if (app.isCurrentChartDirty()) {
      app.showConfirm('Restore this version? Unsaved library changes to the current chart will be lost.', restore);
    } else {
      restore();
    }
  };

})(window.ChartApp = window.ChartApp || {});
