const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DRAFT_KEY = 'chart-creator-state';
const LIBRARY_KEY = 'chart-creator-saved';

function createElement(tagName = 'div') {
  const listeners = new Map();
  return {
    tagName, children: [], dataset: {}, textContent: '', value: '',
    classList: { add() {}, toggle() {} },
    set innerHTML(value) { this.children = []; },
    setAttribute(name, value) { this[name] = value; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, callback) { listeners.set(type, callback); },
    click() { return this.dispatch('click'); },
    dispatch(type) { return listeners.get(type)?.({ target: this, stopPropagation() {} }); },
    focus() {}
  };
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

function createApp() {
  const elements = new Map([
    'status-autosave', 'status-library', 'input-title', 'input-artist', 'input-bpm',
    'input-timesig', 'input-key', 'input-original-key', 'input-capo', 'input-notes'
  ].map(id => [id, createElement()]));
  const data = new Map();
  const failures = new Set();
  const timers = new Map();
  let timerId = 0;
  const app = {};
  const context = vm.createContext({
    window: { ChartApp: app }, TextEncoder,
    console: { warn() {}, error() {} },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [], querySelector: () => null, createElement
    },
    localStorage: {
      getItem: key => data.get(key) || null,
      setItem(key, value) {
        if (failures.has(key)) {
          const error = new Error('Storage full');
          error.name = 'QuotaExceededError';
          throw error;
        }
        data.set(key, String(value));
      }
    },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  for (const file of ['state', 'undo', 'storage', 'ui', 'workflow', 'workspace']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src-js', `${file}.js`), 'utf8');
    vm.runInContext(source, context, { filename: `${file}.js` });
  }
  app.state = app.createEmptyChart();
  app.showToast = () => {};
  app.showAlert = () => {};
  app.showConfirm = (message, callback) => callback();
  app.pushUndo = () => {};
  return {
    app, data, failures, elements,
    addElement(id, tagName) {
      const element = createElement(tagName);
      elements.set(id, element);
      return element;
    },
    flushTimers() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach(callback => callback());
    },
    draftStatus: () => elements.get('status-autosave').textContent,
    libraryStatus: () => elements.get('status-library').textContent
  };
}

test('draft save is explicit about local persistence and never claims a Library save', async () => {
  const env = createApp();
  env.app.state.title = 'First chart';
  env.app.autoSave();
  assert.equal(env.draftStatus(), 'Saving draft…');
  assert.equal(env.libraryStatus(), 'Not saved to Library');
  assert.equal(env.data.has(DRAFT_KEY), false);
  env.flushTimers();
  assert.equal(env.draftStatus(), 'Draft saved on this device');
  assert.equal(JSON.parse(env.data.get(DRAFT_KEY)).title, 'First chart');
  assert.equal(env.data.has(LIBRARY_KEY), false);

  await env.app.saveChartToLibrary();
  assert.equal(env.libraryStatus(), 'Saved to Library');
  env.app.state.artist = 'Changed artist';
  env.app.autoSave();
  assert.equal(env.libraryStatus(), 'Library changes pending');
  env.flushTimers();
  assert.equal(env.libraryStatus(), 'Library changes pending');
  assert.equal(env.app.getSavedCharts()[0].data.artist, '');
});

test('metadata edits and Undo/Redo reflect whether the current chart matches Library', async () => {
  const env = createApp();
  const input = env.addElement('input-info-notes', 'textarea');
  env.app.bindWorkflowEvents();
  await env.app.saveChartToLibrary();
  const undo = new env.app.UndoManager(10);
  undo.push(env.app.state);
  input.value = 'Use alternate intro';
  input.dispatch('input');
  assert.equal(env.libraryStatus(), 'Library changes pending');
  env.app.state = undo.undo(env.app.state);
  env.app.autoSave();
  assert.equal(env.libraryStatus(), 'Saved to Library');
  env.app.state = undo.redo();
  env.app.autoSave();
  assert.equal(env.libraryStatus(), 'Library changes pending');
});

test('failed draft and Library writes preserve the last saved copies and truthful states', async () => {
  const env = createApp();
  env.app.autoSave(true);
  await env.app.saveChartToLibrary();
  const originalDraft = env.data.get(DRAFT_KEY);
  const originalLibrary = env.data.get(LIBRARY_KEY);
  env.failures.add(DRAFT_KEY);
  env.failures.add(LIBRARY_KEY);
  env.app.state.title = 'Not yet saved';
  env.app.autoSave(true);
  await env.app.saveChartToLibrary();
  assert.equal(env.draftStatus(), 'Draft save failed');
  assert.equal(env.elements.get('status-autosave').dataset.saveState, 'failed');
  assert.equal(env.libraryStatus(), 'Library changes pending');
  assert.equal(env.data.get(DRAFT_KEY), originalDraft);
  assert.equal(env.data.get(LIBRARY_KEY), originalLibrary);

  env.app.state = env.app.createEmptyChart();
  await env.app.saveChartToLibrary();
  assert.equal(env.libraryStatus(), 'Not saved to Library');
  env.failures.clear();
  env.app.autoSave(true);
  await env.app.saveChartToLibrary();
  assert.equal(env.draftStatus(), 'Draft saved on this device');
  assert.equal(env.libraryStatus(), 'Saved to Library');
});

test('favorite and group changes do not mark pending chart edits as saved', async () => {
  const env = createApp();
  await env.app.saveChartToLibrary();
  env.app.state.title = 'Unsaved revision';
  env.app.autoSave();
  const charts = env.app.getSavedCharts();
  charts[0].isFavorite = true;
  env.app.saveCharts(charts);
  assert.equal(env.libraryStatus(), 'Library changes pending');
  env.app.updateChartGroup(env.app.state.id, 'practice');
  assert.equal(env.libraryStatus(), 'Library changes pending');
  assert.equal(env.app.getSavedCharts()[0].data.title, '');
  assert.equal(env.app.getSavedCharts()[0].groupId, 'practice');
  env.app.state.title = '';
  env.app.autoSave();
  assert.equal(env.libraryStatus(), 'Saved to Library');
});

test('versions, restoring old content, loading, and deleting update Library status', async () => {
  const env = createApp();
  env.app.state.title = 'Original arrangement';
  env.app.saveChartVersion('Original', '');
  assert.equal(env.libraryStatus(), 'Saved to Library');
  const versionId = env.app.getSavedCharts()[0].versions[0].id;
  env.app.state.title = 'New arrangement';
  await env.app.saveChartToLibrary();
  env.app.restoreChartVersion(versionId);
  assert.equal(env.libraryStatus(), 'Library changes pending');
  assert.equal(env.app.state.title, 'Original arrangement');
  env.app.loadChartFromLibrary(env.app.state.id);
  assert.equal(env.libraryStatus(), 'Saved to Library');
  assert.equal(env.app.state.title, 'New arrangement');
  assert.equal(JSON.parse(env.data.get(DRAFT_KEY)).title, 'New arrangement');
  env.app.deleteChartFromLibrary(env.app.state.id);
  assert.equal(env.libraryStatus(), 'Not saved to Library');
});

test('edits made during folder mirroring stay pending after mirroring completes', async () => {
  const env = createApp();
  let completeMirror;
  env.app.saveChartFileToDirectory = () => new Promise(resolve => { completeMirror = resolve; });
  const saving = env.app.saveChartToLibrary();
  assert.equal(env.libraryStatus(), 'Saved to Library');
  env.app.state.title = 'Edited while saving';
  env.app.autoSave();
  completeMirror('/charts/chart.json');
  await saving;
  assert.equal(env.libraryStatus(), 'Library changes pending');
});

test('empty Library provides working save/create actions and separates filtered results', async () => {
  const env = createApp();
  const grid = env.addElement('library-card-grid');
  const search = env.addElement('full-library-search', 'input');
  const save = env.addElement('btn-save-library', 'button');
  const create = env.addElement('btn-new', 'button');
  let saves = 0;
  let creates = 0;
  save.addEventListener('click', () => { saves += 1; });
  create.addEventListener('click', () => { creates += 1; });
  env.app.renderFullLibrary();
  let nodes = descendants(grid);
  assert.ok(nodes.some(node => node.textContent === 'Your Library is empty'));
  nodes.find(node => node.textContent === 'Save current draft').click();
  nodes.find(node => node.textContent === 'Create chart').click();
  assert.equal(saves, 1);
  assert.equal(creates, 1);
  assert.equal(env.app.activeWorkspace, 'editor');

  env.app.state.title = 'Saved song';
  await env.app.saveChartToLibrary();
  search.value = 'unmatched';
  env.app.renderFullLibrary();
  nodes = descendants(grid);
  assert.ok(nodes.some(node => node.textContent === 'No matching charts'));
  assert.equal(nodes.some(node => node.textContent === 'Save current draft'), false);
  nodes.find(node => node.textContent === 'Clear filters').click();
  assert.equal(search.value, '');
  assert.equal(env.app.librarySelectedGroupId, 'all');
  assert.ok(descendants(grid).some(node => node.textContent === 'Saved song'));
});

test('Find and Replace reveal the editor from compact panels and restore the prior panel', () => {
  for (const [panel, mode, fieldId] of [
    ['details', 'find', 'search-find-input'],
    ['preview', 'replace', 'search-replace-input']
  ]) {
    const env = createApp();
    const workspace = env.addElement('editor-view');
    const search = env.addElement('search-replace-bar');
    search.style = { display: 'none' };
    const field = env.addElement(fieldId, 'input');
    let focusedPanel = null;
    field.focus = () => { focusedPanel = workspace.dataset.panel; };
    env.app.showWorkspacePanel(panel);
    env.app.openSearchReplace(mode);
    assert.equal(workspace.dataset.panel, 'editor');
    assert.equal(focusedPanel, 'editor', 'Reveal the editor before focusing its search field');
    assert.equal(search.style.display, 'flex');
    env.app.closeSearchReplace();
    assert.equal(search.style.display, 'none');
    assert.equal(workspace.dataset.panel, panel);

    env.app.openSearchReplace(mode);
    env.app.closeSearchReplace({ restore: false });
    assert.equal(workspace.dataset.panel, 'editor', 'Dismissal during navigation must not restore an old panel');
  }
});
