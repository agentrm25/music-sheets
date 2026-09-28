(function(app) {
  'use strict';

  app.showWorkspacePanel = function(panel) {
    if (!['details', 'editor', 'preview'].includes(panel)) return;
    const workspace = document.getElementById('editor-view');
    if (!workspace) return;
    workspace.dataset.panel = panel;
    document.querySelectorAll('[data-workspace-panel]').forEach(button => {
      const active = button.dataset.workspacePanel === panel;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (app.previewAutoFit && app.fitPreview) app.fitPreview();
  };

  app.startChart = function() {
    app.pushUndo();
    const section = app.createSection('verse', app.state.sections);
    section.lines.push(app.createLine('grid'));
    app.state.sections.push(section);
    app.commitChange();
    app.showWorkspacePanel('editor');
    document.querySelector(`.line-input[data-line-id="${section.lines[0].id}"]`)?.focus();
  };

  app.bindWorkspaceEvents = function() {
    document.querySelectorAll('[data-workspace-panel]').forEach(button => {
      button.addEventListener('click', () => app.showWorkspacePanel(button.dataset.workspacePanel));
    });
    document.getElementById('btn-start-chart')?.addEventListener('click', app.startChart);
    document.getElementById('btn-start-import')?.addEventListener('click', () => {
      document.getElementById('btn-import-text').click();
    });

    const menu = document.getElementById('toolbar-more');
    menu?.addEventListener('click', event => {
      if (event.target.closest('button')) {
        // A modal records its opener in the button handler. Use the summary,
        // which stays visible after this disclosure closes, as that opener.
        menu.querySelector('summary').focus();
        menu.open = false;
      }
    }, true);
    document.addEventListener('click', event => {
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const scroll = document.getElementById('preview-scroll');
      if (scroll) {
        const observer = new ResizeObserver(() => {
          if (app.previewAutoFit && app.fitPreview) app.fitPreview();
        });
        observer.observe(scroll);
      }
    }
  };
})(window.ChartApp = window.ChartApp || {});
