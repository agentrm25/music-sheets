(function(app) {
  'use strict';

  app.activeWorkspace = 'editor';
  app.activeEditorTab = 'sections';
  app.librarySelectedGroupId = 'all';

  let pendingGroupId = null;
  let pendingCollectSectionId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }

  function sectionLineText(line) {
    if (!line) return '';
    if (line.type === 'grid') return [line.chords, line.content].filter(Boolean).join(' / ');
    return line.content || '';
  }

  function createEmptyMessage(title, detail) {
    const empty = document.createElement('div');
    empty.className = 'empty-state compact-empty-state';

    const emptyTitle = document.createElement('div');
    emptyTitle.className = 'empty-state-title';
    emptyTitle.textContent = title;

    const emptyDesc = document.createElement('div');
    emptyDesc.className = 'empty-state-desc';
    emptyDesc.textContent = detail;

    empty.appendChild(emptyTitle);
    empty.appendChild(emptyDesc);
    return empty;
  }

  function createMiniChartPreview(data) {
    const chart = app.normalizeState(data);
    const preview = document.createElement('div');
    preview.className = 'mini-chart-preview';

    const title = document.createElement('div');
    title.className = 'mini-chart-title';
    title.textContent = chart.title || 'Untitled Chart';
    preview.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'mini-chart-meta';
    meta.textContent = [chart.artist, chart.key ? `Key ${chart.key}` : ''].filter(Boolean).join(' · ');
    preview.appendChild(meta);

    const sectionWrap = document.createElement('div');
    sectionWrap.className = 'mini-chart-sections';
    const sections = chart.sections.slice(0, 4);
    if (!sections.length) {
      const row = document.createElement('div');
      row.className = 'mini-chart-row muted';
      row.textContent = 'No sections yet';
      sectionWrap.appendChild(row);
    } else {
      sections.forEach(section => {
        const label = document.createElement('div');
        label.className = `mini-chart-section-label ${section.type || 'custom'}`;
        label.textContent = app.getSectionDisplayTitle(section);
        sectionWrap.appendChild(label);

        const firstLine = (section.lines || []).map(sectionLineText).find(Boolean);
        if (firstLine) {
          const row = document.createElement('div');
          row.className = 'mini-chart-row';
          row.textContent = firstLine;
          sectionWrap.appendChild(row);
        }
      });
    }
    preview.appendChild(sectionWrap);
    return preview;
  }

  function createSectionPreview(section) {
    const preview = document.createElement('div');
    preview.className = 'collected-section-preview';

    const title = document.createElement('div');
    title.className = `mini-chart-section-label ${section.type || 'custom'}`;
    title.textContent = app.getSectionDisplayTitle(section);
    preview.appendChild(title);

    (section.lines || []).slice(0, 4).forEach(line => {
      const text = sectionLineText(line);
      if (!text) return;
      const row = document.createElement('div');
      row.className = 'mini-chart-row';
      row.textContent = text;
      preview.appendChild(row);
    });
    return preview;
  }

  function getFilteredLibraryCharts() {
    const search = ($('full-library-search')?.value || '').trim().toLowerCase();
    const sort = $('full-library-sort')?.value || 'date';
    const selected = app.librarySelectedGroupId || 'all';
    let charts = app.getSavedCharts();

    if (selected === 'ungrouped') {
      charts = charts.filter(chart => !chart.groupId);
    } else if (selected !== 'all') {
      charts = charts.filter(chart => chart.groupId === selected);
    }

    if (search) {
      charts = charts.filter(chart => {
        const groupName = app.getGroupName(chart.groupId).toLowerCase();
        return [
          chart.name,
          chart.data.artist,
          chart.key,
          groupName,
          chart.data.status
        ].some(value => (value || '').toLowerCase().includes(search));
      });
    }

    charts.sort((a, b) => {
      if (sort === 'alpha') return a.name.localeCompare(b.name);
      if (sort === 'key') return (a.key || 'Z').localeCompare(b.key || 'Z');
      if (sort === 'group') return app.getGroupName(a.groupId).localeCompare(app.getGroupName(b.groupId));
      return new Date(b.savedAt) - new Date(a.savedAt);
    });

    return charts;
  }

  function createGroupButton(id, label, count) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `library-group-btn ${app.librarySelectedGroupId === id ? 'active' : ''}`;
    btn.setAttribute('aria-pressed', String(app.librarySelectedGroupId === id));
    btn.addEventListener('click', () => {
      app.librarySelectedGroupId = id;
      app.renderFullLibrary();
    });

    const name = document.createElement('span');
    name.textContent = label;

    const badge = document.createElement('span');
    badge.className = 'library-group-count';
    badge.textContent = count;

    btn.appendChild(name);
    btn.appendChild(badge);
    return btn;
  }

  app.renderGroups = function() {
    const list = $('library-group-list');
    if (!list) return;
    const charts = app.getSavedCharts();
    const groups = app.getGroups();
    list.innerHTML = '';

    list.appendChild(createGroupButton('all', 'All Charts', charts.length));
    list.appendChild(createGroupButton('ungrouped', 'Ungrouped', charts.filter(chart => !chart.groupId).length));

    groups.forEach(group => {
      const row = document.createElement('div');
      row.className = 'library-group-row';
      if (app.librarySelectedGroupId === group.id) row.classList.add('active');

      const btn = createGroupButton(group.id, group.name, charts.filter(chart => chart.groupId === group.id).length);
      row.appendChild(btn);

      const actions = document.createElement('div');
      actions.className = 'library-group-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm btn-ghost';
      editBtn.textContent = 'Rename';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        app.openGroupModal(group.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-ghost';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', e => {
        e.stopPropagation();
        app.showConfirm(`Delete "${group.name}"?`, () => app.deleteGroup(group.id));
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
  };

  app.renderGroupOptions = function() {
    const groupInput = $('input-group');
    if (!groupInput) return;
    const current = app.state.groupId || '';
    groupInput.innerHTML = '';

    const ungrouped = document.createElement('option');
    ungrouped.value = '';
    ungrouped.textContent = 'Ungrouped';
    groupInput.appendChild(ungrouped);

    app.getGroups().forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      groupInput.appendChild(option);
    });

    groupInput.value = current;
  };

  function createGroupSelect(chart) {
    const select = document.createElement('select');
    select.className = 'form-select library-card-group-select';
    select.setAttribute('aria-label', `Group for ${chart.name}`);

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Ungrouped';
    select.appendChild(blank);

    app.getGroups().forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      select.appendChild(option);
    });

    select.value = chart.groupId || '';
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('change', e => {
      e.stopPropagation();
      app.updateChartGroup(chart.data.id, select.value);
    });
    return select;
  }

  function createLibraryCard(chart) {
    const card = document.createElement('article');
    card.className = 'library-card';
    const openChart = () => app.requestLoadChartFromLibrary(chart.data.id);
    card.addEventListener('click', openChart);

    card.appendChild(createMiniChartPreview(chart.data));

    const body = document.createElement('div');
    body.className = 'library-card-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'library-card-title-row';

    const title = document.createElement('div');
    title.className = 'library-card-title';
    title.textContent = chart.name;

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = `favorite-btn ${chart.isFavorite ? 'favorited' : ''}`;
    favBtn.textContent = chart.isFavorite ? '★' : '☆';
    favBtn.title = chart.isFavorite ? 'Remove from favorites' : 'Add to favorites';
    favBtn.setAttribute('aria-label', favBtn.title);
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      const charts = app.getSavedCharts();
      const entry = charts.find(item => item.data.id === chart.data.id);
      if (!entry) return;
      entry.isFavorite = !entry.isFavorite;
      app.saveCharts(charts);
      app.renderSavedCharts();
      app.renderFullLibrary();
    });

    titleRow.appendChild(title);
    titleRow.appendChild(favBtn);
    body.appendChild(titleRow);

    const meta = document.createElement('div');
    meta.className = 'library-card-meta';
    meta.textContent = [
      chart.data.artist,
      chart.key ? `Key ${chart.key}` : '',
      `${chart.sectionsCount} section${chart.sectionsCount === 1 ? '' : 's'}`,
      formatDate(chart.savedAt)
    ].filter(Boolean).join(' · ');
    body.appendChild(meta);

    const footer = document.createElement('div');
    footer.className = 'library-card-footer';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn btn-sm btn-primary';
    openBtn.textContent = 'Open';
    openBtn.setAttribute('aria-label', `Open ${chart.name}`);
    openBtn.addEventListener('click', event => {
      event.stopPropagation();
      openChart();
    });
    footer.appendChild(openBtn);
    footer.appendChild(createGroupSelect(chart));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-sm btn-ghost';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      app.showConfirm(`Delete "${chart.name}" permanently?`, () => app.deleteChartFromLibrary(chart.data.id));
    });
    footer.appendChild(deleteBtn);

    body.appendChild(footer);
    card.appendChild(body);
    return card;
  }

  app.renderFullLibrary = function() {
    const grid = $('library-card-grid');
    if (!grid) return;
    app.renderGroups();
    grid.innerHTML = '';

    const charts = getFilteredLibraryCharts();
    if (!charts.length) {
      grid.appendChild(createEmptyMessage('No charts found', 'Save charts or change the current group/search filter.'));
      return;
    }

    charts.forEach(chart => grid.appendChild(createLibraryCard(chart)));
  };

  app.renderVersions = function() {
    const list = $('versions-list');
    if (!list) return;
    list.innerHTML = '';

    const chart = app.getSavedCharts().find(entry => entry.data.id === app.state.id);
    const versions = chart ? chart.versions || [] : [];
    if (!versions.length) {
      list.appendChild(createEmptyMessage('No versions saved', 'Use Save Version before trying a major arrangement change.'));
      return;
    }

    versions.forEach(version => {
      const card = document.createElement('article');
      card.className = 'version-card';
      card.appendChild(createMiniChartPreview(version.data));

      const body = document.createElement('div');
      body.className = 'version-card-body';

      const title = document.createElement('div');
      title.className = 'version-card-title';
      title.textContent = version.name;
      body.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'library-card-meta';
      meta.textContent = [
        version.key ? `Key ${version.key}` : '',
        `${version.sectionsCount} section${version.sectionsCount === 1 ? '' : 's'}`,
        formatDate(version.createdAt)
      ].filter(Boolean).join(' · ');
      body.appendChild(meta);

      if (version.notes) {
        const notes = document.createElement('div');
        notes.className = 'version-notes';
        notes.textContent = version.notes;
        body.appendChild(notes);
      }

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn btn-sm btn-primary';
      restoreBtn.type = 'button';
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', () => app.restoreChartVersion(version.id));
      body.appendChild(restoreBtn);

      card.appendChild(body);
      list.appendChild(card);
    });
  };

  app.renderInfoPanel = function() {
    app.renderGroupOptions();
    const status = $('input-status');
    const source = $('input-source');
    const notes = $('input-info-notes');
    if (status && document.activeElement !== status) status.value = app.state.status || '';
    if (source && document.activeElement !== source) source.value = app.state.source || '';
    if (notes && document.activeElement !== notes) notes.value = app.state.infoNotes || '';
  };

  app.renderCollectedSections = function() {
    const list = $('collected-list');
    if (!list) return;
    list.innerHTML = '';

    const items = app.getCollectedSections();
    if (!items.length) {
      list.appendChild(createEmptyMessage('Nothing collected yet', 'Use the star action on a section card to save reusable sections here.'));
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'collected-card';

      const header = document.createElement('div');
      header.className = 'collected-card-header';

      const titleWrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'version-card-title';
      title.textContent = item.name;
      const meta = document.createElement('div');
      meta.className = 'library-card-meta';
      meta.textContent = `${item.sourceChartTitle} · ${formatDate(item.savedAt)}`;
      titleWrap.appendChild(title);
      titleWrap.appendChild(meta);
      header.appendChild(titleWrap);

      const actions = document.createElement('div');
      actions.className = 'collected-card-actions';

      const insertBtn = document.createElement('button');
      insertBtn.type = 'button';
      insertBtn.className = 'btn btn-sm btn-primary';
      insertBtn.textContent = 'Insert';
      insertBtn.addEventListener('click', () => app.insertCollectedSection(item.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-ghost';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => app.requestDeleteCollectedSection(item.id));

      actions.appendChild(insertBtn);
      actions.appendChild(deleteBtn);
      header.appendChild(actions);

      card.appendChild(header);
      card.appendChild(createSectionPreview(item.section));
      list.appendChild(card);
    });
  };

  app.refreshWorkflowPanels = function() {
    if (app.activeEditorTab === 'versions') app.renderVersions();
    if (app.activeEditorTab === 'info') app.renderInfoPanel();
    if (app.activeEditorTab === 'collected') app.renderCollectedSections();
    if (app.activeWorkspace === 'library') app.renderFullLibrary();
  };

  app.showWorkspace = function(mode) {
    const nextWorkspace = mode === 'library' ? 'library' : 'editor';
    if (nextWorkspace === 'library' && app.isSearchReplaceOpen?.()) {
      app.closeSearchReplace({ restore: false });
    }
    app.activeWorkspace = nextWorkspace;
    const editorView = $('editor-view');
    const libraryView = $('library-view');
    const editorBtn = $('btn-editor-view');
    const libraryBtn = $('btn-library-view');
    if (editorView) {
      editorView.hidden = app.activeWorkspace !== 'editor';
      editorView.classList.toggle('active', app.activeWorkspace === 'editor');
    }
    if (libraryView) {
      libraryView.hidden = app.activeWorkspace !== 'library';
      libraryView.classList.toggle('active', app.activeWorkspace === 'library');
    }
    if (editorBtn) editorBtn.classList.toggle('active', app.activeWorkspace === 'editor');
    if (editorBtn) editorBtn.setAttribute('aria-pressed', String(app.activeWorkspace === 'editor'));
    if (libraryBtn) {
      libraryBtn.classList.toggle('active', app.activeWorkspace === 'library');
      libraryBtn.setAttribute('aria-pressed', String(app.activeWorkspace === 'library'));
    }
    if (app.activeWorkspace === 'library') app.renderFullLibrary();
  };

  app.showEditorTab = function(tab) {
    const nextTab = tab || 'sections';
    if (nextTab !== 'sections' && app.isSearchReplaceOpen?.()) {
      app.closeSearchReplace({ restore: false });
    }
    app.activeEditorTab = nextTab;
    document.querySelectorAll('[data-editor-tab]').forEach(btn => {
      const active = btn.dataset.editorTab === app.activeEditorTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-editor-tab-panel]').forEach(panel => {
      const active = panel.dataset.editorTabPanel === app.activeEditorTab;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    document.querySelectorAll('[data-editor-tab-actions]').forEach(actions => {
      actions.classList.toggle('hidden', actions.dataset.editorTabActions !== app.activeEditorTab);
    });
    app.refreshWorkflowPanels();
  };

  app.openGroupModal = function(groupId = null) {
    pendingGroupId = groupId;
    const group = groupId ? app.getGroups().find(item => item.id === groupId) : null;
    const modal = $('group-modal');
    const title = $('group-modal-title');
    const input = $('group-name-input');
    if (!modal || !title || !input) return;
    title.textContent = group ? 'Rename Group' : 'New Group';
    input.value = group ? group.name : '';
    app.openModal(modal, { initialFocus: input });
  };

  app.closeGroupModal = function() {
    pendingGroupId = null;
    const modal = $('group-modal');
    if (modal) app.closeModal(modal);
  };

  app.openVersionModal = function() {
    const modal = $('version-modal');
    const name = $('version-name-input');
    const notes = $('version-notes-input');
    if (!modal || !name || !notes) return;
    const chart = app.getSavedCharts().find(entry => entry.data.id === app.state.id);
    const nextNumber = chart ? (chart.versions || []).length + 1 : 1;
    name.value = `Version ${nextNumber}`;
    notes.value = '';
    app.openModal(modal, { initialFocus: name });
    name.select();
  };

  app.closeVersionModal = function() {
    const modal = $('version-modal');
    if (modal) app.closeModal(modal);
  };

  app.openCollectSectionModal = function(sectionId) {
    pendingCollectSectionId = sectionId;
    const section = app.state.sections.find(item => item.id === sectionId);
    const modal = $('collect-section-modal');
    const input = $('collect-section-name-input');
    if (!section || !modal || !input) return;
    input.value = app.getSectionDisplayTitle(section);
    app.openModal(modal, { initialFocus: input });
    input.select();
  };

  app.closeCollectSectionModal = function() {
    pendingCollectSectionId = null;
    const modal = $('collect-section-modal');
    if (modal) app.closeModal(modal);
  };

  app.bindWorkflowEvents = function() {
    $('btn-editor-view')?.addEventListener('click', () => app.showWorkspace('editor'));
    $('btn-library-view')?.addEventListener('click', () => app.showWorkspace('library'));

    const editorTabs = Array.from(document.querySelectorAll('[data-editor-tab]'));
    editorTabs.forEach(btn => {
      btn.addEventListener('click', () => app.showEditorTab(btn.dataset.editorTab));
      btn.addEventListener('keydown', event => {
        let nextIndex = null;
        const currentIndex = editorTabs.indexOf(btn);
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % editorTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + editorTabs.length) % editorTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = editorTabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = editorTabs[nextIndex];
        app.showEditorTab(nextTab.dataset.editorTab);
        nextTab.focus();
      });
    });

    $('btn-new-group')?.addEventListener('click', () => app.openGroupModal());
    $('full-library-search')?.addEventListener('input', () => app.renderFullLibrary());
    $('full-library-sort')?.addEventListener('change', () => app.renderFullLibrary());

    $('btn-group-cancel')?.addEventListener('click', () => app.closeGroupModal());
    $('btn-group-save')?.addEventListener('click', () => {
      const name = $('group-name-input')?.value || '';
      if (pendingGroupId) {
        if (app.renameGroup(pendingGroupId, name)) app.closeGroupModal();
      } else {
        if (app.createGroup(name)) app.closeGroupModal();
      }
    });

    $('btn-save-version')?.addEventListener('click', () => app.openVersionModal());
    $('btn-version-cancel')?.addEventListener('click', () => app.closeVersionModal());
    $('btn-version-save')?.addEventListener('click', () => {
      app.saveChartVersion($('version-name-input')?.value || '', $('version-notes-input')?.value || '');
      app.closeVersionModal();
    });

    $('btn-collect-cancel')?.addEventListener('click', () => app.closeCollectSectionModal());
    $('btn-collect-save')?.addEventListener('click', () => {
      if (pendingCollectSectionId) {
        app.saveCollectedSection(pendingCollectSectionId, $('collect-section-name-input')?.value || '');
      }
      app.closeCollectSectionModal();
    });

    $('input-group')?.addEventListener('change', e => {
      app.state.groupId = e.target.value || '';
      if (app.state.id) app.updateChartGroup(app.state.id, app.state.groupId);
      if (app.autoSave) app.autoSave();
    });

    [
      ['input-status', 'status'],
      ['input-source', 'source'],
      ['input-info-notes', 'infoNotes']
    ].forEach(([id, prop]) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('focus', () => app.snapshotTextEdit());
      el.addEventListener('blur', () => app.commitTextEdit());
      el.addEventListener('input', () => {
        app.state[prop] = el.value;
        if (app.autoSave) app.autoSave();
      });
    });

    [$('version-modal'), $('group-modal'), $('collect-section-modal')].forEach(modal => {
      if (!modal) return;
      modal.addEventListener('click', e => {
        if (e.target !== modal) return;
        if (modal.id === 'version-modal') app.closeVersionModal();
        if (modal.id === 'group-modal') app.closeGroupModal();
        if (modal.id === 'collect-section-modal') app.closeCollectSectionModal();
      });
    });
  };

})(window.ChartApp = window.ChartApp || {});
