(function(app) {
  'use strict';

  // Narrow windows show one panel at a time: the editor or the preview.
  // 'details' (from older callers) means the editor with song details in view.
  app.showWorkspacePanel = function(panel) {
    if (!['details', 'editor', 'preview'].includes(panel)) return;
    const workspace = document.getElementById('editor-view');
    if (!workspace) return;
    const showDetails = panel === 'details';
    const target = showDetails ? 'editor' : panel;
    workspace.dataset.panel = target;
    document.querySelectorAll('[data-workspace-panel]').forEach(button => {
      const active = button.dataset.workspacePanel === target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (showDetails) document.getElementById('chart-header')?.scrollIntoView?.({ block: 'start' });
    if (app.previewAutoFit && app.fitPreview) app.fitPreview();
  };

  app.startChart = function() {
    app.pushUndo();
    const section = app.createSection('verse', app.state.sections);
    section.lines.push(app.createLine('grid'));
    app.state.sections.push(section);
    app.activeSectionId = section.id;
    app.commitChange();
    app.showWorkspacePanel('editor');
    document.querySelector(`.line-input[data-line-id="${section.lines[0].id}"]`)?.focus();
  };

  // ----- Menus -------------------------------------------------------------
  // Every <details data-menu> behaves like a menu: one open at a time, closed
  // by an outside click or Escape, and closed when one of its commands runs.

  function openMenus() {
    return Array.from(document.querySelectorAll('details[data-menu]')).filter(menu => menu.open);
  }

  function closeMenu(menu, { focusSummary = false } = {}) {
    if (!menu || !menu.open) return;
    menu.open = false;
    if (focusSummary) menu.querySelector('summary')?.focus();
  }

  app.closeMenus = function(except = null) {
    openMenus().forEach(menu => {
      if (except && (menu === except || menu.contains(except))) return;
      closeMenu(menu);
    });
  };

  const MENU_COMMAND = '.menu-item, .toolbar-menu button, [data-menu-close]';

  // Flip a menu upward when it would run off the bottom of its scroll area
  // or the window and there is more room above.
  function placeMenuPanel(menu) {
    const panel = menu.querySelector(':scope > .menu-panel');
    const summary = menu.querySelector(':scope > summary');
    if (!panel || !summary || typeof panel.getBoundingClientRect !== 'function') return;
    panel.classList.remove('menu-panel-up');
    const scroller = menu.closest('.editor-sections, .library-card-grid');
    const bounds = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const bottomLimit = Math.min(bounds.bottom, window.innerHeight);
    const topLimit = Math.max(bounds.top, 0);
    const anchor = summary.getBoundingClientRect();
    const height = panel.getBoundingClientRect().height;
    const roomBelow = bottomLimit - anchor.bottom;
    const roomAbove = anchor.top - topLimit;
    if (height + 8 > roomBelow && roomAbove > roomBelow) panel.classList.add('menu-panel-up');
  }

  app.bindMenus = function() {
    // Capture phase: close before the command runs, and move focus to the
    // menu's button so a dialog it opens can return focus there.
    document.addEventListener('click', event => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const command = target.closest(MENU_COMMAND);
      const menu = command ? command.closest('details[data-menu]') : null;
      if (menu) {
        closeMenu(menu, { focusSummary: true });
        // Nested menus (a section's add-line menu inside its card) stay put.
        return;
      }
      const owner = target.closest('details[data-menu]');
      app.closeMenus(owner);
    }, true);

    document.addEventListener('toggle', event => {
      const menu = event.target;
      if (!menu || !menu.matches?.('details[data-menu]') || !menu.open) return;
      app.closeMenus(menu);
      placeMenuPanel(menu);
      if (menu.querySelector('[data-add-section-panel]') && app.renderAddSectionMenus) app.renderAddSectionMenus();
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || (app.hasOpenModal && app.hasOpenModal())) return;
      const menus = openMenus();
      if (!menus.length) return;
      const active = document.activeElement;
      const menu = menus.find(item => item.contains(active)) || menus[menus.length - 1];
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu(menu, { focusSummary: true });
    }, true);
  };

  app.bindWorkspaceEvents = function() {
    document.querySelectorAll('[data-workspace-panel]').forEach(button => {
      button.addEventListener('click', () => app.showWorkspacePanel(button.dataset.workspacePanel));
    });
    document.getElementById('btn-start-chart')?.addEventListener('click', app.startChart);
    app.bindMenus();

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
