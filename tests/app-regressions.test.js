const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = require('node:path').resolve(__dirname, '..');

function freshRequire(relativePath) {
  const modulePath = require.resolve(require('node:path').join(ROOT, relativePath));
  delete require.cache[modulePath];
  require(modulePath);
}

class MemoryStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
    this.writes = [];
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    const stringValue = String(value);
    this.data.set(key, stringValue);
    this.writes.push({ key, value: stringValue });
  }

  removeItem(key) {
    this.data.delete(key);
  }

  clearWrites() {
    this.writes.length = 0;
  }
}

function makeEvent(type, properties = {}) {
  return Object.assign({
    type,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; }
  }, properties);
}

function elementMatches(element, rawSelector) {
  let selector = rawSelector.trim();
  if (!selector) return false;
  if (selector.includes(' ')) selector = selector.split(/\s+/).at(-1);

  if (selector.includes(':not([disabled])')) {
    if (element.disabled) return false;
    selector = selector.replace(':not([disabled])', '');
  }
  if (selector.includes(':not([tabindex="-1"])')) {
    if (String(element.tabIndex) === '-1') return false;
    selector = selector.replace(':not([tabindex="-1"])', '');
  }

  const attributeMatches = [...selector.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g)];
  selector = selector.replace(/\[[^\]]+\]/g, '');
  for (const match of attributeMatches) {
    const actual = element.getAttribute(match[1]);
    if (actual === null) return false;
    if (match[2] !== undefined && actual !== match[2]) return false;
  }

  const idMatch = selector.match(/#([\w-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;
  const classMatches = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
  if (classMatches.some(name => !element.classList.contains(name))) return false;
  const tagMatch = selector.match(/^[a-z][\w-]*/i);
  if (tagMatch && element.tagName !== tagMatch[0].toUpperCase()) return false;
  return true;
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = this.tagName === 'BUTTON' || this.tagName === 'INPUT' || this.tagName === 'SELECT' || this.tagName === 'TEXTAREA' ? 0 : -1;
    this.textContent = '';
    this.innerHTML = '';
    this.title = '';
    this.id = '';
    this.className = '';
    this.classList = {
      add: (...names) => {
        const next = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach(name => next.add(name));
        this.className = [...next].join(' ');
      },
      remove: (...names) => {
        const remove = new Set(names);
        this.className = this.className.split(/\s+/).filter(name => name && !remove.has(name)).join(' ');
      },
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const active = force === undefined ? !this.classList.contains(name) : !!force;
        if (active) this.classList.add(name); else this.classList.remove(name);
        return active;
      }
    };
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') this.id = stringValue;
    if (name === 'class') this.className = stringValue;
    if (name === 'tabindex') this.tabIndex = Number(stringValue);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    if (name === 'tabindex') return String(this.tabIndex);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return this.dataset[key] === undefined ? null : String(this.dataset[key]);
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    if (child.nodeType === 11) {
      const children = [...child.children];
      child.children.length = 0;
      children.forEach(item => this.appendChild(item));
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChild(replacement, current) {
    const index = this.children.indexOf(current);
    if (index < 0) return current;
    const replacements = replacement.nodeType === 11 ? [...replacement.children] : [replacement];
    replacements.forEach(child => { child.parentNode = this; });
    this.children.splice(index, 1, ...replacements);
    if (replacement.nodeType === 11) replacement.children.length = 0;
    current.parentNode = null;
    return current;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some(child => child === candidate || (typeof child.contains === 'function' && child.contains(candidate)));
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
    const propertyHandler = this[`on${event.type}`];
    if (typeof propertyHandler === 'function') propertyHandler.call(this, event);
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(makeEvent('click'));
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(makeEvent('focus'));
  }

  select() {
    this.focus();
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    const results = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (child.nodeType !== 1) continue;
        if (selectors.some(item => elementMatches(child, item))) results.push(child);
        visit(child);
      }
    };
    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  scrollIntoView() {}
  scrollTo() {}
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

class FakeTextNode {
  constructor(value, ownerDocument) {
    this.nodeType = 3;
    this.nodeValue = String(value);
    this.textContent = this.nodeValue;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
  }
}

class FakeDocument {
  constructor({ autoCreate = false } = {}) {
    this.autoCreate = autoCreate;
    this.elements = new Map();
    this.listeners = new Map();
    this.body = new FakeElement('body', this);
    this.activeElement = this.body;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(value) {
    return new FakeTextNode(value, this);
  }

  createDocumentFragment() {
    const fragment = new FakeElement('fragment', this);
    fragment.nodeType = 11;
    return fragment;
  }

  createTreeWalker(root) {
    const nodes = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (child.nodeType === 3) nodes.push(child);
        else visit(child);
      }
    };
    visit(root);
    let index = 0;
    return { nextNode: () => nodes[index++] || null };
  }

  register(id, tagName = 'div', parent = this.body) {
    const element = this.createElement(tagName);
    element.id = id;
    element.setAttribute('id', id);
    this.elements.set(id, element);
    if (parent) parent.appendChild(element);
    return element;
  }

  getElementById(id) {
    if (!this.elements.has(id) && this.autoCreate) this.register(id);
    return this.elements.get(id) || null;
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this.body;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
    return !event.defaultPrevented;
  }
}

function installEnvironment(options = {}) {
  const originals = {
    window: global.window,
    document: global.document,
    localStorage: global.localStorage,
    navigatorDescriptor: Object.getOwnPropertyDescriptor(global, 'navigator'),
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    ResizeObserver: global.ResizeObserver,
    NodeFilter: global.NodeFilter
  };
  const document = options.document || new FakeDocument(options);
  const localStorage = options.localStorage || new MemoryStorage();
  const app = options.app || {};
  const window = { ChartApp: app, document };
  if (options.tauriInvoke) window.__TAURI__ = { core: { invoke: options.tauriInvoke } };

  global.window = window;
  global.document = document;
  global.localStorage = localStorage;
  Object.defineProperty(global, 'navigator', { value: { platform: 'MacIntel' }, configurable: true });
  global.setTimeout = () => 1;
  global.clearTimeout = () => {};
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.NodeFilter = { SHOW_TEXT: 4 };

  return {
    app,
    document,
    localStorage,
    restore() {
      global.window = originals.window;
      global.document = originals.document;
      global.localStorage = originals.localStorage;
      if (originals.navigatorDescriptor) Object.defineProperty(global, 'navigator', originals.navigatorDescriptor);
      else delete global.navigator;
      global.setTimeout = originals.setTimeout;
      global.clearTimeout = originals.clearTimeout;
      global.ResizeObserver = originals.ResizeObserver;
      global.NodeFilter = originals.NodeFilter;
    }
  };
}

function loadStateAndStorage(environment) {
  freshRequire('src-js/state.js');
  freshRequire('src-js/storage.js');
  environment.app.renderSavedCharts = () => {};
  environment.app.renderFullLibrary = () => {};
  environment.app.renderInfoPanel = () => {};
  environment.app.renderVersions = () => {};
  environment.app.renderEditor = () => {};
  environment.app.renderPreview = () => {};
  environment.app.updateStatusBar = () => {};
  environment.app.refreshWorkflowPanels = () => {};
  environment.app.showWorkspace = () => {};
  environment.app.showToast = () => {};
}

function savedEntry(app, id, title = id) {
  const data = app.normalizeState({ id, title, sections: [] });
  return {
    name: title,
    data,
    savedAt: '2026-07-15T00:00:00.000Z',
    key: '',
    sectionsCount: 0,
    isFavorite: false,
    groupId: '',
    versions: []
  };
}

test('B20 saved-chart reads normalize without writing storage', () => {
  const storage = new MemoryStorage({
    'chart-creator-saved': JSON.stringify([{ name: 'Legacy', data: { id: 'legacy', title: 'Legacy', sections: [] } }])
  });
  const environment = installEnvironment({ localStorage: storage });
  try {
    loadStateAndStorage(environment);
    storage.clearWrites();

    const charts = environment.app.getSavedCharts();

    assert.equal(charts[0].data.editorHeight, undefined);
    assert.equal(charts[0].data.sections.length, 0);
    assert.deepEqual(storage.writes, []);
  } finally {
    environment.restore();
  }
});

test('B20 legacy draft identities stay stable across read-only auto-loads', () => {
  const storage = new MemoryStorage({
    'chart-creator-state': JSON.stringify({
      title: 'Legacy Draft',
      sections: [{
        type: 'verse',
        lines: [{ type: 'lyric', content: 'Legacy draft line' }]
      }]
    })
  });
  const environment = installEnvironment({ localStorage: storage });
  try {
    loadStateAndStorage(environment);
    storage.clearWrites();

    assert.equal(environment.app.autoLoad(), true);
    const firstIds = {
      chart: environment.app.state.id,
      section: environment.app.state.sections[0].id,
      line: environment.app.state.sections[0].lines[0].id
    };
    assert.equal(environment.app.autoLoad(), true);
    const secondIds = {
      chart: environment.app.state.id,
      section: environment.app.state.sections[0].id,
      line: environment.app.state.sections[0].lines[0].id
    };

    assert.deepEqual(secondIds, firstIds);
    assert.deepEqual(storage.writes, []);
  } finally {
    environment.restore();
  }
});

test('B20 legacy saved-chart identities stay stable across read-only normalization', () => {
  const legacyData = {
    title: 'Legacy',
    sections: [{
      type: 'verse',
      lines: [{ type: 'lyric', content: 'Same legacy line' }]
    }]
  };
  const storage = new MemoryStorage({
    'chart-creator-saved': JSON.stringify([
      {
        name: 'Legacy',
        data: legacyData,
        versions: [{ name: 'First', data: legacyData }]
      },
      { name: 'Legacy duplicate', data: legacyData }
    ])
  });
  const environment = installEnvironment({ localStorage: storage });
  try {
    loadStateAndStorage(environment);
    storage.clearWrites();

    const first = environment.app.getSavedCharts();
    const second = environment.app.getSavedCharts();
    const identities = charts => charts.map(chart => ({
      chart: chart.data.id,
      savedAt: chart.savedAt,
      section: chart.data.sections[0].id,
      line: chart.data.sections[0].lines[0].id,
      versions: chart.versions.map(version => ({
        version: version.id,
        createdAt: version.createdAt,
        chart: version.data.id,
        section: version.data.sections[0].id,
        line: version.data.sections[0].lines[0].id
      }))
    }));

    assert.deepEqual(identities(second), identities(first));
    assert.notEqual(first[0].data.id, first[1].data.id);
    environment.app.state = first[0].data;
    assert.equal(environment.app.isCurrentChartDirty(), false);
    assert.deepEqual(storage.writes, []);
  } finally {
    environment.restore();
  }
});

test('B20 legacy group and collected-section reads are stable and side-effect free', () => {
  const storage = new MemoryStorage({
    'chart-creator-groups': JSON.stringify([{ name: 'Legacy group' }]),
    'chart-creator-collected-sections': JSON.stringify([{
      name: 'Legacy section',
      section: { type: 'chorus', lines: [{ type: 'lyric', content: 'Legacy' }] }
    }])
  });
  const environment = installEnvironment({ localStorage: storage });
  try {
    loadStateAndStorage(environment);
    storage.clearWrites();

    const firstGroups = environment.app.getGroups();
    const firstItems = environment.app.getCollectedSections();
    const secondGroups = environment.app.getGroups();
    const secondItems = environment.app.getCollectedSections();

    assert.deepEqual(secondGroups, firstGroups);
    assert.deepEqual(secondItems, firstItems);
    assert.ok(firstGroups[0].id);
    assert.ok(firstItems[0].id);
    assert.ok(firstItems[0].section.id);
    assert.ok(firstItems[0].section.lines[0].id);
    assert.deepEqual(storage.writes, []);
  } finally {
    environment.restore();
  }
});

test('B20 legacy version data inherits its parent chart identity through restore and save', async () => {
  const storage = new MemoryStorage({
    'chart-creator-saved': JSON.stringify([{
      name: 'Parent',
      data: { id: 'parent', title: 'Parent', sections: [] },
      versions: [{
        name: 'Legacy version',
        data: { title: 'Parent restored', sections: [] }
      }]
    }])
  });
  const environment = installEnvironment({ localStorage: storage });
  try {
    loadStateAndStorage(environment);
    const chart = environment.app.getSavedCharts()[0];
    assert.equal(chart.versions[0].data.id, 'parent');
    environment.app.state = chart.data;
    environment.app.pushUndo = () => {};
    environment.app.refreshUndoState = () => {};

    environment.app.restoreChartVersion(chart.versions[0].id);
    await environment.app.saveChartToLibrary({ silent: true });

    assert.equal(environment.app.state.id, 'parent');
    assert.equal(environment.app.getSavedCharts().length, 1);
  } finally {
    environment.restore();
  }
});

test('B23 library quota failures use the accessible in-app alert and remain atomic', async () => {
  const document = new FakeDocument();
  const modal = document.register('alert-modal');
  document.register('alert-modal-title', 'h3', modal);
  const message = document.register('alert-message', 'p', modal);
  const ok = document.register('alert-ok', 'button', modal);
  document.register('toast-container');
  const storage = new MemoryStorage();
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === 'chart-creator-saved') {
      const error = new Error('Synthetic quota boundary');
      error.name = 'QuotaExceededError';
      throw error;
    }
    setItem(key, value);
  };
  const originalAlert = global.alert;
  const originalConsoleError = console.error;
  let nativeAlertCalls = 0;
  const loggedErrors = [];
  global.alert = () => { nativeAlertCalls += 1; };
  console.error = (...args) => { loggedErrors.push(args); };
  const environment = installEnvironment({ document, localStorage: storage });
  try {
    freshRequire('src-js/ui.js');
    loadStateAndStorage(environment);
    environment.app.state = environment.app.normalizeState({
      id: 'quota-chart',
      title: 'Quota Chart',
      sections: []
    });

    await environment.app.saveChartToLibrary();

    assert.equal(storage.getItem('chart-creator-saved'), null);
    assert.equal(nativeAlertCalls, 0);
    assert.match(String(loggedErrors[0]?.[0]), /library save failed/i);
    assert.equal(modal.style.display, 'flex');
    assert.match(message.textContent, /local storage is full/i);
    assert.equal(document.activeElement, ok);
    ok.click();
    assert.equal(modal.style.display, 'none');
  } finally {
    environment.restore();
    if (originalAlert === undefined) delete global.alert;
    else global.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

test('B06 mirror filenames are stable by chart ID and collision-free by title', async () => {
  const invocations = [];
  const environment = installEnvironment({
    tauriInvoke: async (command, args) => {
      invocations.push({ command, args });
      return `/qa/${args.fileName}`;
    }
  });
  try {
    loadStateAndStorage(environment);
    environment.app.saveSettings({ saveDirectory: '/qa' });

    await environment.app.saveChartFileToDirectory({ name: 'Same/Title', data: { id: 'alpha' } });
    await environment.app.saveChartFileToDirectory({ name: 'Same:Title', data: { id: 'beta' } });
    await environment.app.saveChartFileToDirectory({ name: 'Renamed', data: { id: 'alpha' } });

    assert.equal(invocations.length, 3);
    invocations.forEach(invocation => {
      assert.equal(invocation.command, 'save_chart_file');
      assert.equal(invocation.args.directory, '/qa');
    });
    assert.notEqual(invocations[0].args.fileName, invocations[1].args.fileName);
    assert.equal(invocations[0].args.fileName, invocations[2].args.fileName);
    assert.match(invocations[0].args.fileName, /^chart-[0-9a-f]+\.json$/);
    assert.doesNotMatch(invocations[0].args.fileName, /[\\/:*?"<>|]/);
  } finally {
    environment.restore();
  }
});

test('B06 missing or oversized chart IDs never invoke native mirror writing', async () => {
  let invocationCount = 0;
  const environment = installEnvironment({
    tauriInvoke: async () => { invocationCount += 1; }
  });
  try {
    loadStateAndStorage(environment);
    environment.app.saveSettings({ saveDirectory: '/qa' });

    await assert.rejects(() => environment.app.saveChartFileToDirectory({ name: 'Missing', data: {} }), /chart id/i);
    await assert.rejects(() => environment.app.saveChartFileToDirectory({ name: 'Large', data: { id: 'x'.repeat(101) } }), /chart id/i);
    assert.equal(invocationCount, 0);
  } finally {
    environment.restore();
  }
});

test('B07 chart-load requests warn only when the normalized current chart is dirty', () => {
  const environment = installEnvironment();
  try {
    loadStateAndStorage(environment);
    const first = savedEntry(environment.app, 'one', 'One');
    const second = savedEntry(environment.app, 'two', 'Two');
    environment.localStorage.setItem('chart-creator-saved', JSON.stringify([first, second]));
    environment.app.state = environment.app.normalizeState(first.data);

    const loads = [];
    const confirmations = [];
    environment.app.loadChartFromLibrary = id => loads.push(id);
    environment.app.showConfirm = (message, callback) => confirmations.push({ message, callback });

    environment.app.requestLoadChartFromLibrary('two');
    assert.deepEqual(loads, ['two']);
    assert.equal(confirmations.length, 0);

    environment.app.state.title = 'Dirty';
    environment.app.requestLoadChartFromLibrary('one');
    assert.equal(confirmations.length, 1);
    assert.deepEqual(loads, ['two']);
    confirmations[0].callback();
    assert.deepEqual(loads, ['two', 'one']);
  } finally {
    environment.restore();
  }
});

test('B08 loading a library chart immediately autosaves the loaded state', () => {
  const document = new FakeDocument();
  const titleInput = document.register('input-title', 'input');
  const environment = installEnvironment({ document });
  try {
    loadStateAndStorage(environment);
    const target = savedEntry(environment.app, 'target', 'Target');
    environment.localStorage.setItem('chart-creator-saved', JSON.stringify([target]));
    environment.app.state = environment.app.createEmptyChart();
    environment.app.pushUndo = () => {};
    const autoSaves = [];
    let undoRefreshes = 0;
    environment.app.autoSave = immediate => autoSaves.push(immediate);
    environment.app.refreshUndoState = () => { undoRefreshes += 1; };

    environment.app.loadChartFromLibrary('target');

    assert.equal(environment.app.state.id, 'target');
    assert.deepEqual(autoSaves, [true]);
    assert.equal(undoRefreshes, 1);
    assert.equal(document.activeElement.id, titleInput.id);
  } finally {
    environment.restore();
  }
});

test('B11 theme setting persists without erasing the mirror directory', () => {
  const document = new FakeDocument();
  const toggle = document.register('btn-dark-mode', 'button');
  const storage = new MemoryStorage({
    'chart-creator-settings': JSON.stringify({ saveDirectory: '/qa', theme: 'dark' })
  });
  const environment = installEnvironment({ document, localStorage: storage });
  try {
    loadStateAndStorage(environment);

    environment.app.setTheme('light');

    assert.equal(environment.app.getSettings().saveDirectory, '/qa');
    assert.equal(environment.app.getSettings().theme, 'light');
    assert.equal(document.body.classList.contains('light-mode'), true);
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(toggle.getAttribute('aria-label'), 'Light mode');
    assert.equal(toggle.title, 'Switch to dark mode');
    assert.equal(toggle.textContent, '☀️');
  } finally {
    environment.restore();
  }
});

test('B17 collected deletion waits for confirmation and removes only the requested item', () => {
  const environment = installEnvironment();
  try {
    loadStateAndStorage(environment);
    const items = [
      { id: 'a', name: 'A', section: { id: 's1', type: 'verse', lines: [] } },
      { id: 'b', name: 'B', section: { id: 's2', type: 'chorus', lines: [] } }
    ];
    environment.localStorage.setItem('chart-creator-collected-sections', JSON.stringify(items));
    environment.localStorage.clearWrites();
    let confirmation;
    environment.app.showConfirm = (message, callback) => { confirmation = { message, callback }; };

    environment.app.requestDeleteCollectedSection('a');

    assert.match(confirmation.message, /delete.+A/i);
    assert.deepEqual(environment.localStorage.writes, []);
    confirmation.callback();
    const remaining = JSON.parse(environment.localStorage.getItem('chart-creator-collected-sections'));
    assert.deepEqual(remaining.map(item => item.id), ['b']);
  } finally {
    environment.restore();
  }
});

test('B10 saved success toasts do not infer an unrelated Undo action', () => {
  const document = new FakeDocument();
  const container = document.register('toast-container');
  const environment = installEnvironment({ document });
  try {
    environment.app.undo = () => assert.fail('Save toast must not call chart Undo');
    freshRequire('src-js/ui.js');

    environment.app.showToast('"Song" saved', 'success');

    assert.equal(container.querySelector('.toast-action-btn'), null);
  } finally {
    environment.restore();
  }
});

test('B13 replace reports every match and creates one undo transaction', () => {
  const document = new FakeDocument();
  document.register('search-find-input', 'input').value = 'foo';
  document.register('search-replace-input', 'input').value = 'bar';
  document.register('search-regex', 'input').checked = false;
  document.register('search-case-sensitive', 'input').checked = false;
  const environment = installEnvironment({ document });
  try {
    environment.app.state = {
      sections: [{ lines: [
        { type: 'lyric', content: 'foo foo foo' },
        { type: 'grid', content: 'foo', chords: 'foo foo' }
      ] }]
    };
    let undoCount = 0;
    let commitCount = 0;
    const toasts = [];
    freshRequire('src-js/ui.js');
    environment.app.pushUndo = () => { undoCount += 1; };
    environment.app.commitChange = () => { commitCount += 1; };
    environment.app.showToast = (message, type) => toasts.push({ message, type });

    environment.app.searchAndReplace();

    assert.equal(undoCount, 1);
    assert.equal(commitCount, 1);
    assert.equal(environment.app.state.sections[0].lines[0].content, 'bar bar bar');
    assert.equal(environment.app.state.sections[0].lines[1].content, 'bar');
    assert.equal(environment.app.state.sections[0].lines[1].chords, 'bar bar');
    assert.deepEqual(toasts.at(-1), { message: 'Replaced 6 occurrences', type: 'success' });
  } finally {
    environment.restore();
  }
});

test('B13 no-match replace leaves state and undo history untouched', () => {
  const document = new FakeDocument();
  document.register('search-find-input', 'input').value = 'missing';
  document.register('search-replace-input', 'input').value = 'bar';
  document.register('search-regex', 'input').checked = false;
  document.register('search-case-sensitive', 'input').checked = false;
  const environment = installEnvironment({ document });
  try {
    environment.app.state = { sections: [{ lines: [{ type: 'lyric', content: 'untouched' }] }] };
    let undoCount = 0;
    environment.app.pushUndo = () => { undoCount += 1; };
    environment.app.commitChange = () => assert.fail('No-match replace must not commit');
    freshRequire('src-js/ui.js');
    environment.app.showToast = () => {};

    environment.app.searchAndReplace();

    assert.equal(undoCount, 0);
    assert.equal(environment.app.state.sections[0].lines[0].content, 'untouched');
  } finally {
    environment.restore();
  }
});

test('B03 find-replace opens the correct workspace and restores focus on close', () => {
  const document = new FakeDocument();
  const opener = document.register('opener', 'button');
  const bar = document.register('search-replace-bar');
  const find = document.register('search-find-input', 'input', bar);
  const replace = document.register('search-replace-input', 'input', bar);
  const environment = installEnvironment({ document });
  try {
    const transitions = [];
    environment.app.showWorkspace = value => transitions.push(`workspace:${value}`);
    environment.app.showEditorTab = value => transitions.push(`tab:${value}`);
    environment.app.renderPreview = () => {};
    freshRequire('src-js/ui.js');
    opener.focus();

    environment.app.openSearchReplace('replace');

    assert.equal(bar.style.display, 'flex');
    assert.equal(document.activeElement, replace);
    assert.deepEqual(transitions, ['workspace:editor', 'tab:sections']);
    environment.app.closeSearchReplace();
    assert.equal(bar.style.display, 'none');
    assert.equal(document.activeElement, opener);
    assert.notEqual(find, document.activeElement);
  } finally {
    environment.restore();
  }
});

test('B14 modal stack traps focus, closes the top dialog on Escape, and restores focus', () => {
  const document = new FakeDocument();
  const opener = document.register('opener', 'button');
  const firstModal = document.register('first-modal');
  const firstButton = document.register('first-button', 'button', firstModal);
  const lastButton = document.register('last-button', 'button', firstModal);
  const secondModal = document.register('second-modal');
  const secondButton = document.register('second-button', 'button', secondModal);
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/ui.js');
    opener.focus();
    environment.app.openModal(firstModal, { initialFocus: firstButton });
    assert.equal(document.activeElement, firstButton);

    firstButton.focus();
    document.dispatchEvent(makeEvent('keydown', { key: 'Tab', shiftKey: true }));
    assert.equal(document.activeElement, lastButton);

    environment.app.openModal(secondModal, { initialFocus: secondButton });
    assert.equal(document.activeElement, secondButton);
    document.dispatchEvent(makeEvent('keydown', { key: 'Escape' }));
    assert.equal(secondModal.style.display, 'none');
    assert.equal(document.activeElement, lastButton);

    document.dispatchEvent(makeEvent('keydown', { key: 'Escape' }));
    assert.equal(firstModal.style.display, 'none');
    assert.equal(document.activeElement, opener);
  } finally {
    environment.restore();
  }
});

test('B09 JSON import refreshes live undo availability after replacing state', async () => {
  const environment = installEnvironment();
  try {
    freshRequire('src-js/state.js');
    freshRequire('src-js/import-export.js');
    environment.app.state = environment.app.createEmptyChart();
    environment.app.pushUndo = () => {};
    environment.app.syncFormFromState = () => {};
    environment.app.renderEditor = () => {};
    environment.app.renderPreview = () => {};
    environment.app.autoSave = () => {};
    environment.app.showToast = () => {};
    let refreshes = 0;
    let workflowRefreshes = 0;
    environment.app.refreshUndoState = () => { refreshes += 1; };
    environment.app.refreshWorkflowPanels = () => { workflowRefreshes += 1; };
    const imported = {
      id: 'imported',
      title: 'Imported',
      sections: [{ id: 'section', type: 'verse', lines: [] }]
    };

    await environment.app.importJSON({ text: async () => JSON.stringify(imported) });

    assert.equal(environment.app.state.id, 'imported');
    assert.equal(refreshes, 1);
    assert.equal(workflowRefreshes, 1);
  } finally {
    environment.restore();
  }
});

function bootApplication({ theme = 'dark' } = {}) {
  const storage = new MemoryStorage({
    'chart-creator-settings': JSON.stringify({ saveDirectory: '', theme })
  });
  const environment = installEnvironment({ autoCreate: true, localStorage: storage });
  const calls = {
    autoSave: [],
    exportJson: 0,
    exportPdf: 0,
    saveLibrary: 0,
    toasts: []
  };

  freshRequire('src-js/state.js');
  freshRequire('src-js/undo.js');
  freshRequire('src-js/storage.js');
  freshRequire('src-js/ui.js');

  const initialState = environment.app.normalizeState({
    id: 'working',
    originalKey: 'F',
    sections: [{ id: 'section', type: 'chorus', lines: [] }]
  });
  environment.app.state = initialState;
  environment.app.autoLoad = () => {
    environment.app.state = environment.app.normalizeState(initialState);
    return true;
  };
  environment.app.autoSave = immediate => calls.autoSave.push(immediate);
  environment.app.bindWorkflowEvents = () => {};
  environment.app.renderEditor = () => {};
  environment.app.renderPreview = () => {};
  environment.app.renderSavedCharts = () => {};
  environment.app.renderInfoPanel = () => {};
  environment.app.renderCollectedSections = () => {};
  environment.app.renderVersions = () => {};
  environment.app.refreshWorkflowPanels = () => {};
  environment.app.showEditorTab = () => {};
  environment.app.showWorkspace = () => {};
  environment.app.updateStatusBar = () => {};
  environment.app.showToast = (message, type) => calls.toasts.push({ message, type });
  environment.app.showConfirm = (_message, callback) => callback();
  environment.app.exportJSON = () => { calls.exportJson += 1; };
  environment.app.exportPDF = () => { calls.exportPdf += 1; };
  environment.app.saveChartToLibrary = () => { calls.saveLibrary += 1; };
  environment.app.importJSON = () => {};
  environment.app.parseImportText = () => [];
  environment.app.determineUseFlats = () => false;
  environment.app.transposeNote = value => value;
  environment.app.transposeChordLine = value => value;

  freshRequire('app.js');
  environment.document.dispatchEvent(makeEvent('DOMContentLoaded'));
  return { environment, calls };
}

test('B01 Original Key hydrates and its input updates state and autosave', () => {
  const { environment, calls } = bootApplication();
  try {
    const originalKey = environment.document.getElementById('input-original-key');
    assert.equal(originalKey.value, 'F');

    const savesBeforeEdit = calls.autoSave.length;
    originalKey.value = 'G';
    originalKey.dispatchEvent(makeEvent('input'));

    assert.equal(environment.app.state.originalKey, 'G');
    assert.ok(calls.autoSave.length > savesBeforeEdit);
  } finally {
    environment.restore();
  }
});

test('B02 BPM commits a clamped numeric value on blur and change', () => {
  const { environment, calls } = bootApplication();
  try {
    const bpm = environment.document.getElementById('input-bpm');
    const savesBeforeEdit = calls.autoSave.length;
    bpm.value = '301';
    bpm.dispatchEvent(makeEvent('input'));
    assert.equal(environment.app.state.bpm, null);
    assert.equal(calls.autoSave.length, savesBeforeEdit);

    bpm.dispatchEvent(makeEvent('blur'));
    assert.equal(environment.app.state.bpm, 300);
    assert.equal(bpm.value, '300');
    assert.ok(calls.autoSave.length > savesBeforeEdit);

    bpm.value = '19';
    bpm.dispatchEvent(makeEvent('change'));
    assert.equal(environment.app.state.bpm, 20);
    assert.equal(bpm.value, '20');
  } finally {
    environment.restore();
  }
});

test('B04 and B05 toolbar actions and advertised shortcuts invoke distinct commands', () => {
  const { environment, calls } = bootApplication();
  try {
    environment.document.getElementById('btn-save-library').click();
    environment.document.getElementById('btn-export-json').click();
    environment.document.dispatchEvent(makeEvent('keydown', {
      key: 'e',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: environment.document.body
    }));

    assert.equal(calls.saveLibrary, 1);
    assert.equal(calls.exportJson, 1);
    assert.equal(calls.exportPdf, 1);
  } finally {
    environment.restore();
  }
});

test('B03 keyboard shortcuts reveal find and replace rather than focusing hidden input', () => {
  const { environment } = bootApplication();
  try {
    const bar = environment.document.getElementById('search-replace-bar');
    bar.style.display = 'none';
    environment.document.dispatchEvent(makeEvent('keydown', {
      key: 'h',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: environment.document.body
    }));

    assert.equal(bar.style.display, 'flex');
    assert.equal(environment.document.activeElement, environment.document.getElementById('search-replace-input'));
  } finally {
    environment.restore();
  }
});

test('B14 global shortcuts cannot move focus outside an open modal', () => {
  const { environment } = bootApplication();
  try {
    const modal = environment.document.getElementById('shortcuts-modal');
    const close = environment.document.getElementById('btn-shortcuts-close');
    environment.app.openModal(modal, { initialFocus: close });

    const findEvent = makeEvent('keydown', {
      key: 'f',
      metaKey: true,
      ctrlKey: false,
      target: close
    });
    environment.document.dispatchEvent(findEvent);

    assert.equal(environment.document.activeElement.id, close.id);
    assert.notEqual(environment.document.getElementById('search-replace-bar').style.display, 'flex');
    assert.equal(findEvent.defaultPrevented, true);

    const textField = environment.document.createElement('textarea');
    modal.appendChild(textField);
    textField.focus();

    const pasteEvent = makeEvent('keydown', {
      key: 'v',
      metaKey: true,
      ctrlKey: false,
      target: textField
    });
    environment.document.dispatchEvent(pasteEvent);
    assert.equal(pasteEvent.defaultPrevented, false);

    const nativeUndoEvent = makeEvent('keydown', {
      key: 'z',
      metaKey: true,
      ctrlKey: false,
      target: textField
    });
    environment.document.dispatchEvent(nativeUndoEvent);
    assert.equal(nativeUndoEvent.defaultPrevented, false);
  } finally {
    environment.restore();
  }
});

test('B14 focused editor inputs retain native Undo instead of routing chart history', () => {
  const { environment } = bootApplication();
  try {
    let chartUndos = 0;
    environment.app.undo = () => { chartUndos += 1; };
    const bpm = environment.document.getElementById('input-bpm');
    bpm.tagName = 'INPUT';
    bpm.focus();
    const nativeUndoEvent = makeEvent('keydown', {
      key: 'z',
      metaKey: true,
      ctrlKey: false,
      target: bpm
    });

    environment.document.dispatchEvent(nativeUndoEvent);

    assert.equal(nativeUndoEvent.defaultPrevented, false);
    assert.equal(chartUndos, 0);

    const chartUndoEvent = makeEvent('keydown', {
      key: 'z',
      metaKey: true,
      ctrlKey: false,
      target: environment.document.body
    });
    environment.document.dispatchEvent(chartUndoEvent);
    assert.equal(chartUndoEvent.defaultPrevented, true);
    assert.equal(chartUndos, 1);
  } finally {
    environment.restore();
  }
});

test('B09 the first live structural mutation enables toolbar Undo', () => {
  const { environment } = bootApplication();
  try {
    const undo = environment.document.getElementById('btn-undo');
    assert.equal(undo.disabled, true);

    environment.app.state.title = 'First change';
    environment.app.commitChange();

    assert.equal(undo.disabled, false);
    undo.click();
    assert.equal(environment.app.state.title, '');
  } finally {
    environment.restore();
  }
});

test('B09 chart Undo and Redo refresh the active workflow panel', () => {
  const { environment } = bootApplication();
  try {
    const baselineId = environment.app.state.id;
    const renderedIds = [];
    environment.app.refreshWorkflowPanels = () => renderedIds.push(environment.app.state.id);
    environment.app.state = environment.app.normalizeState({ id: 'next-chart', title: 'Next', sections: [] });
    environment.app.refreshUndoState();

    environment.app.undo();
    environment.app.redo();

    assert.deepEqual(renderedIds, [baselineId, 'next-chart']);
  } finally {
    environment.restore();
  }
});

test('B11 startup applies the saved theme and the toggle persists its inverse', () => {
  const { environment } = bootApplication({ theme: 'light' });
  try {
    const toggle = environment.document.getElementById('btn-dark-mode');
    assert.equal(environment.document.body.classList.contains('light-mode'), true);
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(toggle.getAttribute('aria-label'), 'Light mode');

    toggle.click();
    assert.equal(environment.app.getSettings().theme, 'dark');
    assert.equal(environment.document.body.classList.contains('light-mode'), false);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(toggle.getAttribute('aria-label'), 'Light mode');
  } finally {
    environment.restore();
  }
});

test('B18 empty text import reports an error and keeps focus in the dialog', () => {
  const { environment, calls } = bootApplication();
  try {
    const textarea = environment.document.getElementById('import-textarea');
    const modal = environment.document.getElementById('import-modal');
    textarea.value = '   \n';
    modal.style.display = 'flex';
    environment.document.getElementById('btn-import-confirm').click();

    assert.equal(modal.style.display, 'flex');
    assert.equal(environment.document.activeElement.id, textarea.id);
    assert.match(calls.toasts.at(-1).message, /paste|enter|empty/i);
    assert.equal(calls.toasts.at(-1).type, 'error');
  } finally {
    environment.restore();
  }
});

test('B14 Escape closes only the top modal and leaves find-replace open', () => {
  const { environment } = bootApplication();
  try {
    environment.app.openSearchReplace('find');
    const searchBar = environment.document.getElementById('search-replace-bar');
    const modal = environment.document.getElementById('shortcuts-modal');
    environment.app.openModal(modal, {
      initialFocus: environment.document.getElementById('btn-shortcuts-close')
    });

    environment.document.dispatchEvent(makeEvent('keydown', {
      key: 'Escape',
      metaKey: false,
      ctrlKey: false,
      target: environment.document.body
    }));

    assert.equal(modal.style.display, 'none');
    assert.equal(searchBar.style.display, 'flex');
  } finally {
    environment.restore();
  }
});

test('B14 modal trap redirects Tab when focus is already outside the dialog', () => {
  const document = new FakeDocument();
  const modal = document.register('modal');
  const first = document.register('first', 'button', modal);
  document.register('last', 'button', modal);
  const outside = document.register('outside', 'button');
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/ui.js');
    environment.app.openModal(modal, { initialFocus: first });
    outside.focus();
    const event = makeEvent('keydown', { key: 'Tab', target: outside });

    document.dispatchEvent(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(document.activeElement.id, first.id);
  } finally {
    environment.restore();
  }
});

test('B03 closing find restores the workspace, tab, and visible opener', () => {
  const document = new FakeDocument();
  const opener = document.register('full-library-search', 'input');
  const bar = document.register('search-replace-bar');
  bar.style.display = 'none';
  document.register('search-find-input', 'input', bar);
  document.register('search-replace-input', 'input', bar);
  document.register('search-regex', 'input', bar);
  document.register('search-case-sensitive', 'input', bar);
  document.register('chart-paper');
  const environment = installEnvironment({ document });
  try {
    environment.app.activeWorkspace = 'library';
    environment.app.activeEditorTab = 'info';
    const workspaces = [];
    const tabs = [];
    environment.app.showWorkspace = mode => {
      workspaces.push(mode);
      environment.app.activeWorkspace = mode;
    };
    environment.app.showEditorTab = tab => {
      tabs.push(tab);
      environment.app.activeEditorTab = tab;
    };
    freshRequire('src-js/ui.js');
    opener.focus();

    environment.app.openSearchReplace('find');
    environment.app.closeSearchReplace();

    assert.deepEqual(workspaces, ['editor', 'library']);
    assert.deepEqual(tabs, ['sections', 'info']);
    assert.equal(document.activeElement.id, opener.id);
  } finally {
    environment.restore();
  }
});

test('B03 leaving the editor dismisses find without restoring its old workspace', () => {
  const document = new FakeDocument();
  const editorView = document.register('editor-view');
  const libraryView = document.register('library-view');
  libraryView.hidden = true;
  document.register('btn-editor-view', 'button');
  document.register('btn-library-view', 'button');
  const opener = document.register('input-status', 'input');
  const bar = document.register('search-replace-bar');
  bar.style.display = 'none';
  document.register('search-find-input', 'input', bar);
  document.register('search-replace-input', 'input', bar);
  document.register('search-regex', 'input', bar);
  document.register('search-case-sensitive', 'input', bar);
  document.register('chart-paper');
  const environment = installEnvironment({ document });
  try {
    environment.app.renderPreview = () => {};
    environment.app.getSavedCharts = () => [];
    environment.app.getGroups = () => [];
    environment.app.getCollectedSections = () => [];
    freshRequire('src-js/ui.js');
    freshRequire('src-js/workflow.js');
    environment.app.renderFullLibrary = () => {};
    environment.app.activeWorkspace = 'editor';
    environment.app.activeEditorTab = 'info';
    opener.focus();

    environment.app.openSearchReplace('find');
    environment.app.showWorkspace('library');

    assert.equal(environment.app.activeWorkspace, 'library');
    assert.equal(editorView.hidden, true);
    assert.equal(libraryView.hidden, false);
    assert.equal(bar.style.display, 'none');
  } finally {
    environment.restore();
  }
});

test('B03 regex highlighting preserves backreferences across multiple text nodes', () => {
  const document = new FakeDocument();
  const find = document.register('search-find-input', 'input');
  const regex = document.register('search-regex', 'input');
  const matchCase = document.register('search-case-sensitive', 'input');
  const paper = document.register('chart-paper');
  for (const value of ['aa', 'AA', 'aa']) {
    const line = document.createElement('p');
    line.appendChild(document.createTextNode(value));
    paper.appendChild(line);
  }
  const environment = installEnvironment({ document });
  try {
    environment.app.renderPreview = () => {};
    freshRequire('src-js/ui.js');
    find.value = '(a)\\1';
    regex.checked = true;
    matchCase.checked = true;

    environment.app.highlightSearchPreview();

    const highlights = paper.querySelectorAll('.search-highlight');
    assert.deepEqual(highlights.map(element => element.textContent), ['aa', 'aa']);
  } finally {
    environment.restore();
  }
});

test('B15 editor line and section controls expose keyboard controls and bounded inputs', () => {
  const document = new FakeDocument();
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/constants.js');
    freshRequire('src-js/state.js');
    environment.app.state = environment.app.normalizeState({
      sections: [
        { id: 'verse', type: 'verse', verseNumber: 1, lines: [{ id: 'line', type: 'lyric', content: '', bold: false }] },
        { id: 'chorus', type: 'chorus', repeat: 1, lines: [] }
      ]
    });
    environment.app.pushUndo = () => {};
    environment.app.commitChange = () => {};
    environment.app.autoSave = () => {};
    environment.app.updateStatusBar = () => {};
    freshRequire('src-js/editor.js');

    const verseCard = environment.app.buildSectionCard(environment.app.state.sections[0], 0);
    const verseNumber = verseCard.querySelector('.verse-number-input');
    verseNumber.value = '100';
    verseNumber.dispatchEvent(makeEvent('change'));
    assert.equal(environment.app.state.sections[0].verseNumber, 99);
    assert.equal(verseNumber.value, '99');

    const collapse = verseCard.querySelector('.section-collapse-toggle');
    assert.equal(collapse.getAttribute('aria-expanded'), 'true');
    const sectionActions = verseCard.querySelector('.section-card-actions').querySelectorAll('button');
    assert.ok(sectionActions.length > 0);
    sectionActions.forEach(button => assert.ok(button.getAttribute('aria-label')));

    const lineItem = environment.app.buildLineItem(
      environment.app.state.sections[0],
      environment.app.state.sections[0].lines[0],
      0,
      0
    );
    const lineDrag = lineItem.querySelector('.line-drag-handle');
    assert.equal(lineDrag.tagName, 'BUTTON');
    assert.match(lineDrag.getAttribute('aria-label'), /reorder/i);
    assert.match(lineDrag.getAttribute('aria-keyshortcuts'), /ArrowDown/);
    lineItem.querySelectorAll('.line-input').forEach(input => assert.ok(input.getAttribute('aria-label')));
    lineItem.querySelectorAll('.line-action-btn').forEach(button => assert.ok(button.getAttribute('aria-label')));

    const gridLine = environment.app.createLine('grid', 'Words');
    gridLine.chords = 'C G';
    const gridItem = environment.app.buildLineItem(environment.app.state.sections[0], gridLine, 0, 1);
    const gridInputs = gridItem.querySelectorAll('.line-input');
    assert.match(gridInputs[0].getAttribute('aria-label'), /chord/i);
    assert.match(gridInputs[1].getAttribute('aria-label'), /lyric/i);

    const chorusCard = environment.app.buildSectionCard(environment.app.state.sections[1], 1);
    const repeat = chorusCard.querySelector('.section-repeat-input');
    repeat.value = '100';
    repeat.dispatchEvent(makeEvent('change'));
    assert.equal(environment.app.state.sections[1].repeat, 99);
    assert.equal(repeat.value, '99');
  } finally {
    environment.restore();
  }
});

test('B15 editor tabs synchronize ARIA state and support arrow-key navigation', () => {
  const document = new FakeDocument();
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/state.js');
    const names = ['sections', 'versions', 'info', 'collected'];
    const tabs = names.map((name, index) => {
      const tab = document.register(`${name}-tab`, 'button');
      tab.setAttribute('data-editor-tab', name);
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      tab.tabIndex = index === 0 ? 0 : -1;
      const panel = document.register(`${name}-tab-panel`);
      panel.setAttribute('data-editor-tab-panel', name);
      return tab;
    });
    environment.app.getSavedCharts = () => [];
    environment.app.getGroups = () => [];
    environment.app.getCollectedSections = () => [];
    environment.app.renderGroupOptions = () => {};
    freshRequire('src-js/workflow.js');
    environment.app.bindWorkflowEvents();

    environment.app.showEditorTab('info');
    assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
    assert.equal(tabs[2].tabIndex, 0);
    assert.equal(tabs[0].getAttribute('aria-selected'), 'false');
    assert.equal(tabs[0].tabIndex, -1);

    tabs[2].focus();
    tabs[2].dispatchEvent(makeEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(document.activeElement, tabs[3]);
    assert.equal(environment.app.activeEditorTab, 'collected');
  } finally {
    environment.restore();
  }
});

test('B07 and B15 full-library cards use an explicit accessible Open action', () => {
  const document = new FakeDocument();
  const grid = document.register('library-card-grid');
  document.register('library-group-list');
  document.register('full-library-search', 'input');
  document.register('full-library-sort', 'select').value = 'date';
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/constants.js');
    freshRequire('src-js/state.js');
    freshRequire('src-js/editor.js');
    const chart = savedEntry(environment.app, 'chart', 'Chart');
    environment.app.state = environment.app.normalizeState(chart.data);
    environment.app.getSavedCharts = () => [chart];
    environment.app.getGroups = () => [];
    environment.app.saveCharts = () => {};
    environment.app.renderSavedCharts = () => {};
    environment.app.showConfirm = () => assert.fail('Card should delegate dirty decisions');
    const requested = [];
    environment.app.requestLoadChartFromLibrary = id => requested.push(id);
    freshRequire('src-js/workflow.js');

    environment.app.renderFullLibrary();
    const card = grid.querySelector('.library-card');
    assert.equal(card.getAttribute('role'), null);
    const openButton = card.querySelectorAll('button').find(button => /^Open$/.test(button.textContent));
    assert.ok(openButton, 'Expected an explicit Open button');
    const favoriteButton = card.querySelector('.favorite-btn');
    assert.match(favoriteButton.getAttribute('aria-label'), /favorite/i);
    const groupSelect = card.querySelector('.library-card-group-select');
    assert.match(groupSelect.getAttribute('aria-label'), /group/i);
    openButton.click();
    assert.deepEqual(requested, ['chart']);
  } finally {
    environment.restore();
  }
});

test('B17 collected-card Delete delegates to the confirmed request path', () => {
  const document = new FakeDocument();
  const list = document.register('collected-list');
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/constants.js');
    freshRequire('src-js/state.js');
    freshRequire('src-js/editor.js');
    environment.app.state = environment.app.createEmptyChart();
    environment.app.getCollectedSections = () => [{
      id: 'item',
      name: 'Reusable',
      sourceChartTitle: 'Source',
      savedAt: '2026-07-15T00:00:00.000Z',
      section: environment.app.createSection('chorus')
    }];
    environment.app.insertCollectedSection = () => {};
    environment.app.deleteCollectedSection = () => assert.fail('UI must not delete directly');
    const requested = [];
    environment.app.requestDeleteCollectedSection = id => requested.push(id);
    freshRequire('src-js/workflow.js');

    environment.app.renderCollectedSections();
    const deleteButton = list.querySelectorAll('button').find(button => button.textContent === 'Delete');
    deleteButton.click();
    assert.deepEqual(requested, ['item']);
  } finally {
    environment.restore();
  }
});

test('B07 and B15 sidebar library entries delegate loading and support keyboard activation', () => {
  const document = new FakeDocument();
  const list = document.register('saved-charts-list');
  document.register('library-search', 'input');
  document.register('library-sort', 'select').value = 'date';
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/state.js');
    const chart = savedEntry(environment.app, 'sidebar-chart', 'Sidebar Chart');
    environment.app.state = environment.app.normalizeState(chart.data);
    environment.app.getSavedCharts = () => [chart];
    environment.app.saveCharts = () => {};
    environment.app.showConfirm = () => assert.fail('Sidebar entry must delegate dirty decisions');
    const requested = [];
    environment.app.requestLoadChartFromLibrary = id => requested.push(id);
    freshRequire('src-js/ui.js');

    environment.app.renderSavedCharts();
    const content = list.querySelector('.library-item-content');
    assert.equal(content.getAttribute('role'), 'button');
    assert.equal(content.tabIndex, 0);
    content.dispatchEvent(makeEvent('keydown', { key: ' ' }));
    assert.deepEqual(requested, ['sidebar-chart']);
  } finally {
    environment.restore();
  }
});

test('B14 Settings opens and closes through the shared modal controller', () => {
  const document = new FakeDocument();
  const modal = document.register('settings-modal');
  const closeButton = document.register('btn-settings-close', 'button', modal);
  document.register('settings-save-folder', 'input', modal);
  document.register('settings-save-folder-status', 'div', modal);
  document.register('btn-choose-save-folder', 'button', modal);
  document.register('btn-clear-save-folder', 'button', modal);
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/state.js');
    freshRequire('src-js/storage.js');
    const opens = [];
    const closes = [];
    environment.app.openModal = (target, options) => opens.push({ target, options });
    environment.app.closeModal = target => closes.push(target);

    environment.app.openSettings();
    environment.app.closeSettings();

    assert.equal(opens.length, 1);
    assert.equal(opens[0].target, modal);
    assert.equal(opens[0].options.initialFocus, closeButton);
    assert.deepEqual(closes, [modal]);
  } finally {
    environment.restore();
  }
});

test('B15 section drag handle provides a keyboard reorder path', () => {
  const document = new FakeDocument();
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/constants.js');
    freshRequire('src-js/state.js');
    environment.app.state = environment.app.normalizeState({
      sections: [
        { id: 'first', type: 'verse', verseNumber: 1, lines: [] },
        { id: 'second', type: 'chorus', lines: [] }
      ]
    });
    environment.app.pushUndo = () => {};
    environment.app.commitChange = () => {
      document.querySelectorAll('.section-card').forEach(item => item.remove());
      environment.app.state.sections.forEach((item, index) => {
        document.body.appendChild(environment.app.buildSectionCard(item, index));
      });
    };
    environment.app.autoSave = () => {};
    environment.app.updateStatusBar = () => {};
    freshRequire('src-js/editor.js');

    const card = environment.app.buildSectionCard(environment.app.state.sections[0], 0);
    document.body.appendChild(card);
    const handle = card.querySelector('.section-drag-handle');
    handle.focus();
    const event = makeEvent('keydown', { key: 'ArrowDown', altKey: true });
    handle.dispatchEvent(event);

    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(environment.app.state.sections.map(section => section.id), ['second', 'first']);
    assert.match(handle.getAttribute('aria-keyshortcuts'), /ArrowDown/);
    const movedCard = document.querySelectorAll('.section-card').find(item => item.dataset.sectionId === 'first');
    assert.equal(document.activeElement === movedCard.querySelector('.section-drag-handle'), true);
  } finally {
    environment.restore();
  }
});

test('B15 line drag handle moves a boundary line across sections and restores focus', () => {
  const document = new FakeDocument();
  const environment = installEnvironment({ document });
  try {
    freshRequire('src-js/constants.js');
    freshRequire('src-js/state.js');
    environment.app.state = environment.app.normalizeState({
      sections: [
        { id: 'first', type: 'verse', verseNumber: 1, lines: [{ id: 'moving', type: 'lyric', content: 'Move me' }] },
        { id: 'second', type: 'chorus', lines: [{ id: 'stays', type: 'lyric', content: 'Stay' }] }
      ]
    });
    environment.app.pushUndo = () => {};
    environment.app.autoSave = () => {};
    environment.app.updateStatusBar = () => {};
    freshRequire('src-js/editor.js');
    environment.app.commitChange = () => {
      document.querySelectorAll('.section-card').forEach(item => item.remove());
      environment.app.state.sections.forEach((item, index) => {
        document.body.appendChild(environment.app.buildSectionCard(item, index));
      });
    };
    environment.app.commitChange();
    const handle = document.querySelectorAll('.line-drag-handle')
      .find(item => item.dataset.lineId === 'moving');
    handle.focus();
    const event = makeEvent('keydown', { key: 'ArrowDown', altKey: true });

    handle.dispatchEvent(event);

    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(environment.app.state.sections[0].lines, []);
    assert.deepEqual(environment.app.state.sections[1].lines.map(line => line.id), ['moving', 'stays']);
    const movedHandle = document.querySelectorAll('.line-drag-handle')
      .find(item => item.dataset.lineId === 'moving');
    assert.equal(document.activeElement === movedHandle, true);
  } finally {
    environment.restore();
  }
});

test('B05 JSON export uses a readable fallback filename for sanitized-empty titles', () => {
  const document = new FakeDocument();
  let anchor = null;
  const createElement = document.createElement.bind(document);
  document.createElement = tagName => {
    const element = createElement(tagName);
    if (String(tagName).toLowerCase() === 'a') anchor = element;
    return element;
  };
  const environment = installEnvironment({ document });
  try {
    environment.app.state = { id: 'chart', title: '歌曲///', sections: [] };
    environment.app.showToast = () => {};
    freshRequire('src-js/import-export.js');

    environment.app.exportJSON();

    assert.equal(anchor.download, 'chart.json');
  } finally {
    environment.restore();
  }
});
