const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'src-js', 'ui.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(root, 'src-js', 'storage.js'), 'utf8');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openingTagById(id) {
  const match = html.match(new RegExp(`<[^>]+\\bid=["']${escapeRegex(id)}["'][^>]*>`, 'i'));
  return match?.[0] || '';
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${escapeRegex(name)}=["']([^"']*)["']`, 'i'));
  return match?.[1] ?? null;
}

function elementTextById(id) {
  const match = html.match(new RegExp(`<([a-z][\\w-]*)[^>]*\\bid=["']${escapeRegex(id)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
  return match?.[2].replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() || '';
}

function tagsWithAttribute(name) {
  return [...html.matchAll(new RegExp(`<[^>]+\\b${escapeRegex(name)}(?:=["'][^"']*["'])?[^>]*>`, 'gi'))]
    .map(match => match[0]);
}

function balancedBlockAfter(source, marker) {
  const start = source.search(marker);
  assert.notEqual(start, -1, `Missing CSS block matching ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`Unclosed CSS block matching ${marker}`);
}

test('toolbar distinguishes library save from JSON export', () => {
  const save = openingTagById('btn-save-library');
  const exportJson = openingTagById('btn-export-json');

  assert.ok(save, 'Expected a #btn-save-library button');
  assert.match(`${attribute(save, 'title')} ${elementTextById('btn-save-library')}`, /save.+library/i);
  assert.equal(openingTagById('btn-save-json'), '', 'Obsolete ambiguous #btn-save-json must be removed');
  assert.ok(exportJson, 'Expected a #btn-export-json button');
  assert.match(`${attribute(exportJson, 'title')} ${elementTextById('btn-export-json')}`, /export.+json/i);

  assert.match(html, /Cmd\/Ctrl\s*\+\s*E[\s\S]*Export PDF/i);
  assert.doesNotMatch(html, /Cmd\/Ctrl\s*\+\s*Click/i);
});

test('all eight modal overlays expose stable accessible names', () => {
  const overlays = [...html.matchAll(/<div\b(?=[^>]*\bclass=["'][^"']*\bmodal-overlay\b[^"']*["'])[^>]*>/gi)]
    .map(match => match[0]);
  assert.equal(overlays.length, 8);

  for (const overlay of overlays) {
    const id = attribute(overlay, 'id');
    const labelledBy = attribute(overlay, 'aria-labelledby');
    assert.equal(attribute(overlay, 'role'), 'dialog', `${id} needs role=dialog`);
    assert.equal(attribute(overlay, 'aria-modal'), 'true', `${id} needs aria-modal=true`);
    assert.ok(labelledBy, `${id} needs aria-labelledby`);
    assert.ok(openingTagById(labelledBy), `${id} references missing label #${labelledBy}`);
  }

  const titles = [...html.matchAll(/<h3\b(?=[^>]*\bclass=["'][^"']*\bmodal-title\b[^"']*["'])[^>]*>/gi)]
    .map(match => match[0]);
  assert.equal(titles.length, 8);
  titles.forEach(title => assert.ok(attribute(title, 'id'), 'Every modal title needs a stable id'));
  assert.equal(attribute(openingTagById('import-modal'), 'aria-describedby'), 'import-modal-description');
  assert.equal(attribute(openingTagById('confirm-modal'), 'aria-describedby'), 'confirm-message');
  assert.equal(attribute(openingTagById('alert-modal'), 'aria-describedby'), 'alert-message');
});

test('editor tabs and panels have complete ARIA relationships and initial state', () => {
  const tabNames = ['sections', 'versions', 'info', 'collected'];
  for (const [index, name] of tabNames.entries()) {
    const tab = openingTagById(`${name}-tab`);
    const panel = openingTagById(`${name}-tab-panel`);
    assert.ok(tab, `Missing #${name}-tab`);
    assert.equal(attribute(tab, 'role'), 'tab');
    assert.equal(attribute(tab, 'aria-controls'), `${name}-tab-panel`);
    assert.equal(attribute(tab, 'aria-selected'), index === 0 ? 'true' : 'false');
    assert.equal(attribute(tab, 'tabindex'), index === 0 ? '0' : '-1');
    assert.equal(attribute(panel, 'role'), 'tabpanel');
    assert.equal(attribute(panel, 'aria-labelledby'), `${name}-tab`);
  }
});

test('static icon-only controls have accessible names and toggle state', () => {
  const iconButtonIds = [
    'btn-shortcuts',
    'btn-settings',
    'search-close-btn',
    'btn-dark-mode',
    'btn-zoom-out',
    'btn-zoom-in',
    'btn-transpose-down',
    'btn-transpose-up',
    'btn-new-group',
  ];
  iconButtonIds.forEach(id => assert.ok(attribute(openingTagById(id), 'aria-label'), `${id} needs aria-label`));
  assert.equal(attribute(openingTagById('btn-dark-mode'), 'aria-pressed'), 'false');
});

test('search, toast, and autosave feedback expose accessible names and live status', () => {
  assert.equal(attribute(openingTagById('search-find-input'), 'aria-label'), 'Find text');
  assert.equal(attribute(openingTagById('search-replace-input'), 'aria-label'), 'Replacement text');
  assert.equal(attribute(openingTagById('toast-container'), 'role'), 'status');
  assert.equal(attribute(openingTagById('toast-container'), 'aria-live'), 'polite');
  assert.equal(attribute(openingTagById('status-autosave'), 'role'), 'status');
  assert.equal(attribute(openingTagById('status-autosave'), 'aria-live'), 'polite');
});

test('every static user-facing form control has an explicit accessible name', () => {
  const controls = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)].map(match => match[0]);
  controls.forEach(tag => {
    if (/\bclass=["'][^"']*\bhidden\b/i.test(tag) || /\btype=["']hidden["']/i.test(tag)) return;
    const id = attribute(tag, 'id');
    assert.ok(id, `Control needs an id: ${tag}`);
    const explicitName = attribute(tag, 'aria-label') || attribute(tag, 'aria-labelledby');
    const labelledByFor = new RegExp(`<label\\b[^>]*\\bfor=["']${escapeRegex(id)}["']`, 'i').test(html);
    assert.ok(explicitName || labelledByFor, `#${id} needs an explicit accessible name`);
  });
});

test('search highlighting builds text nodes instead of interpolating chart text as HTML', () => {
  const highlightFunction = uiSource.match(/app\.highlightSearchPreview\s*=\s*function\(\)\s*\{([\s\S]*?)\n\s*\};/)?.[1] || '';
  assert.ok(highlightFunction, 'Missing highlightSearchPreview implementation');
  assert.doesNotMatch(highlightFunction, /\.innerHTML\s*=/);
  assert.match(highlightFunction, /createTextNode/);
  assert.doesNotMatch(highlightFunction, /new RegExp\(`\(\$\{searchStr\}\)`/);
});

test('hover-revealed actions remain available to keyboard and touch users', () => {
  assert.match(css, /\.library-group-row:focus-within\s+\.library-group-actions/);
  assert.match(css, /\.section-card:focus-within\s+\.section-card-actions/);
  assert.match(css, /\.line-item:focus-within\s+\.line-actions/);
  assert.match(css, /\.line-item:focus-within\s+\.line-drag-handle/);

  const touch = balancedBlockAfter(css, /@media\s*\(hover:\s*none\)/);
  assert.match(touch, /\.library-group-actions/);
  assert.match(touch, /\.section-card-actions/);
  assert.match(touch, /\.line-actions/);
  assert.match(touch, /\.line-drag-handle/);

  const lineHandle = balancedBlockAfter(css, /\n\.line-drag-handle\s*\{/);
  assert.match(lineHandle, /border\s*:\s*(?:0|none)/);
  assert.match(lineHandle, /background\s*:\s*transparent/);

  assert.match(css, /:focus-visible[^{]*\{[^}]*outline\s*:/s);
});

test('toolbar actions scroll internally before the measured 1115px overflow threshold', () => {
  const tablet = balancedBlockAfter(css, /@media\s*\(max-width:\s*1200px\)/);
  assert.match(tablet, /\.toolbar-actions\s*\{[^}]*min-width\s*:\s*0[^}]*overflow-x\s*:\s*auto/s);
  assert.match(tablet, /\.toolbar-actions\s*>\s*\*\s*\{[^}]*flex-shrink\s*:\s*0/s);
  assert.match(tablet, /\.toolbar-actions\s*\{[^}]*padding-(?:inline-)?end\s*:/s);
});

test('editor and search toolbars contain their own overflow at split-pane widths', () => {
  const editorToolbar = balancedBlockAfter(css, /\n\.editor-toolbar\s*\{/);
  const searchToolbar = balancedBlockAfter(css, /\n\.search-replace-bar\s*\{/);
  assert.match(editorToolbar, /overflow-x\s*:\s*auto/);
  assert.match(searchToolbar, /overflow-x\s*:\s*auto/);
  assert.match(css, /\.editor-toolbar\s*>\s*\*[^}]*flex-shrink\s*:\s*0/s);
  assert.match(css, /\.search-replace-bar\s*>\s*\*[^}]*flex-shrink\s*:\s*0/s);
});

test('legacy line identity seeds stay linear in section size', () => {
  const functionBody = storageSource.match(/function withStableSectionIds[\s\S]*?\n\s*return section;\n\s*\}/)?.[0] || '';
  assert.ok(functionBody);
  assert.match(functionBody, /lineSeed\s*=\s*`\$\{section\.id\}:line:/);
  assert.doesNotMatch(functionBody, /lineSeed\s*=\s*`\$\{sectionSeed\}/);
});

test('Original Key offers the same major and minor choices as Key', () => {
  const keySelect = html.match(/<select[^>]+id=["']input-key["'][^>]*>([\s\S]*?)<\/select>/i)?.[1] || '';
  const originalSelect = html.match(/<select[^>]+id=["']input-original-key["'][^>]*>([\s\S]*?)<\/select>/i)?.[1] || '';
  const optionValues = source => [...source.matchAll(/<option[^>]+value=["']([^"']*)["']/gi)].map(match => match[1]);

  assert.deepEqual(optionValues(originalSelect), optionValues(keySelect));
});

test('QA Tauri config is fully isolated while preserving production capabilities', () => {
  const productionPath = path.join(root, 'src-tauri', 'tauri.conf.json');
  const qaPath = path.join(root, 'src-tauri', 'tauri.qa.conf.json');
  assert.equal(fs.existsSync(qaPath), true, 'Missing isolated QA Tauri config');

  const production = JSON.parse(fs.readFileSync(productionPath, 'utf8'));
  const qa = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
  assert.notEqual(qa.identifier, production.identifier);
  assert.equal(qa.identifier, 'com.chartcreator.music.qa');
  assert.notEqual(qa.productName, production.productName);
  assert.match(qa.build.devUrl, /127\.0\.0\.1:1421/);
  assert.match(qa.app.windows[0].title, /QA.+ISOLATED/i);
  assert.equal(production.build.frontendDist, '../dist');
  assert.equal(qa.build.frontendDist, '../dist-qa');
  assert.notEqual(qa.build.frontendDist, production.build.frontendDist);
  assert.equal(production.app.windows[0].dragDropEnabled, false);
  assert.equal(qa.app.windows[0].dragDropEnabled, false);
  assert.deepEqual(qa.app.security, production.app.security);
  assert.deepEqual(qa.bundle, production.bundle);
});
