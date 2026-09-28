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

  const titles = [...html.matchAll(/<h2\b(?=[^>]*\bclass=["'][^"']*\bmodal-title\b[^"']*["'])[^>]*>/gi)]
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

test('toolbar actions wrap and secondary commands remain available through a labelled disclosure', () => {
  const actions = balancedBlockAfter(css, /\n\.toolbar-actions\s*\{/);
  assert.match(actions, /flex-wrap\s*:\s*wrap/);
  assert.match(actions, /min-width\s*:\s*0/);
  assert.equal(attribute(openingTagById('toolbar-more'), 'class'), 'toolbar-overflow');
  assert.match(html, /<summary[^>]*>More<\/summary>/);
  for (const id of ['btn-new', 'btn-load', 'btn-export-json', 'btn-settings', 'btn-shortcuts']) {
    assert.ok(openingTagById(id), `${id} must remain accessible`);
  }
});

test('editor toolbar wraps while the search toolbar retains its overflow escape', () => {
  const editorToolbar = balancedBlockAfter(css, /\n\.editor-toolbar\s*\{/);
  const searchToolbar = balancedBlockAfter(css, /\n\.search-replace-bar\s*\{/);
  assert.match(editorToolbar, /flex-wrap\s*:\s*wrap/);
  assert.match(searchToolbar, /overflow-x\s*:\s*auto/);
  assert.match(css, /\.editor-toolbar\s*>\s*\*[^}]*max-width\s*:\s*100%/s);
  assert.match(css, /\.search-replace-bar\s*>\s*\*[^}]*flex-shrink\s*:\s*0/s);
});

test('compact workspace provides named controls for details, editing and preview', () => {
  for (const [panel, target] of [['details', 'sidebar'], ['editor', 'editor-panel'], ['preview', 'preview-panel']]) {
    const button = openingTagById(`btn-panel-${panel}`);
    assert.equal(attribute(button, 'aria-controls'), target);
    assert.equal(attribute(button, 'aria-pressed'), String(panel === 'editor'));
  }
  assert.match(html, /src="\.\/src-js\/workspace.js"/);
  assert.ok(openingTagById('btn-start-chart'));
  assert.ok(openingTagById('btn-zoom-fit'));
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

test('library card grid never lets scroll-clipped cards collapse below their content height', () => {
  const grid = balancedBlockAfter(css, /\n\.library-card-grid\s*\{/);
  assert.match(grid, /grid-auto-rows\s*:\s*max-content/);
});

test('line rows keep type, input, and actions on one compact row by default', () => {
  const row = balancedBlockAfter(css, /\n\.line-item\s*\{/);
  assert.match(row, /grid-template-areas\s*:\s*"handle type input bold actions"/);
  assert.doesNotMatch(css, /\.line-type-indicator/);
});

test('sidebar shows a short Recent list that hands browsing to the Library view', () => {
  assert.equal(openingTagById('library-search'), '');
  assert.equal(openingTagById('library-sort'), '');
  assert.match(openingTagById('recent-charts-list'), /^<ul\b/);
  assert.match(elementTextById('btn-open-library'), /Open Library/);
});

const jsSources = ['app.js', ...fs.readdirSync(path.join(root, 'src-js')).map(file => `src-js/${file}`)]
  .map(file => ({ file, source: fs.readFileSync(path.join(root, file), 'utf8') }));

test('motion respects prefers-reduced-motion', () => {
  const reduced = balancedBlockAfter(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(reduced, /animation-duration\s*:/);
  assert.match(reduced, /transition-duration\s*:/);
  assert.match(reduced, /scroll-behavior\s*:\s*auto/);
  const smoothScrolls = jsSources.filter(({ source }) => /behavior:\s*'smooth'/.test(source));
  assert.deepEqual(smoothScrolls.map(({ file }) => file), [], 'use app.scrollBehavior() instead of hard-coded smooth scrolling');
});

test('controls use the SVG icon set instead of emoji or text glyphs', () => {
  const glyphs = /[✋⠿📋🌙☀☆★🗑↩↪✕↑↓▾✓ℹ🎵＋]/u;
  assert.doesNotMatch(html, glyphs, 'index.html');
  jsSources.forEach(({ file, source }) => assert.doesNotMatch(source, glyphs, file));
  for (const name of ['undo', 'redo', 'close', 'grip', 'star', 'star-filled', 'arrow-up', 'arrow-down', 'chevron-down', 'sun', 'moon', 'check', 'alert', 'info', 'plus', 'download']) {
    assert.ok(html.includes(`<symbol id="icon-${name}"`), `missing icon-${name}`);
  }
});

test('landmarks and headings give the editor a navigable outline', () => {
  const editorView = html.slice(html.indexOf('id="editor-view"'), html.indexOf('id="library-view"'));
  assert.match(editorView, /<h1\b[^>]*class="[^"]*visually-hidden/);
  assert.match(editorView, /<h2\b[^>]*id="song-details-heading"/);
  assert.match(editorView, /<h2\b[^>]*id="preview-heading"/);
  const asides = [...html.matchAll(/<aside\b[^>]*>/gi)].map(match => match[0]);
  asides.forEach(tag => assert.ok(attribute(tag, 'aria-labelledby') || attribute(tag, 'aria-label'), `${tag} needs a name`));
  assert.doesNotMatch(html, /<h3\b[^>]*class="modal-title"/);
  assert.match(css, /\.visually-hidden\s*\{/);
});

test('every keyboard-reachable control shows the shared focus ring', () => {
  const block = css.slice(css.indexOf('button:focus-visible,'));
  for (const selector of ['summary:focus-visible', '.section-type-select:focus-visible', 'input[type="checkbox"]:focus-visible', '.recent-chart:focus-visible']) {
    assert.ok(block.includes(selector), `${selector} missing from focus ring rule`);
  }
  const coarse = balancedBlockAfter(css, /@media\s*\(pointer:\s*coarse\)/);
  assert.match(coarse, /min-height\s*:\s*44px/);
});

function tokenBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing ${selector} block`);
  return css.slice(start, css.indexOf('\n}', start));
}

function readTokens(block) {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const [r, g, b] = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255)
    .map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('text tokens meet WCAG AA contrast on every surface in both themes', () => {
  const dark = readTokens(tokenBlock(':root'));
  const light = { ...dark, ...readTokens(tokenBlock('body.light-mode')) };
  const texts = ['--text-primary', '--text-secondary', '--text-tertiary', '--text-accent', '--text-warning', '--text-success', '--text-danger'];
  const surfaces = ['--bg-primary', '--bg-secondary', '--bg-surface', '--bg-elevated'];
  for (const [theme, tokens] of [['dark', dark], ['light', light]]) {
    for (const text of texts) {
      for (const surface of surfaces) {
        const ratio = contrast(tokens[text], tokens[surface]);
        assert.ok(ratio >= 4.5, `${theme}: ${text} on ${surface} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.doesNotMatch(css, /(?<![-\w])color:\s*var\(--accent-(?:primary|warning|success|danger)\)/, 'use --text-* tokens for coloured text');
});

test('theme-sensitive surfaces come from tokens rather than dark-only literals', () => {
  const body = css.slice(css.indexOf('body.light-mode {'));
  assert.doesNotMatch(body.slice(body.indexOf('\n}')), /rgba\(255,\s*255,\s*255/, 'white-alpha literals break light mode');
  assert.match(balancedBlockAfter(css, /\n\.preview-panel\s*\{/), /background\s*:\s*var\(--bg-preview-well\)/);
  const light = tokenBlock('body.light-mode');
  for (const token of ['--hover-overlay', '--bg-preview-well', '--shadow-lg', '--scrollbar-thumb', '--select-chevron']) {
    assert.match(light, new RegExp(`${token}\\s*:`), `light mode must override ${token}`);
  }
});

test('stacking uses the semantic z-index scale', () => {
  const values = [...css.matchAll(/z-index\s*:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(values.length > 0);
  values.forEach(value => assert.match(value, /^var\(--z-[\w-]+\)$/, `raw z-index ${value}`));
  const root = readTokens(tokenBlock(':root'));
  const order = ['--z-raised', '--z-sticky', '--z-dropdown', '--z-modal', '--z-modal-top', '--z-toast'].map(token => Number(root[token]));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('design tokens are all used and transitions name their properties', () => {
  assert.doesNotMatch(css, /transition\s*:\s*all\b/);
  const defined = Object.keys(readTokens(tokenBlock(':root')));
  const everything = css + jsSources.map(({ source }) => source).join('\n');
  defined.forEach(token => {
    const uses = everything.split(`var(${token}`).length - 1;
    assert.ok(uses > 0, `${token} is defined but never used`);
  });
});

test('appearance toggle lives with app-wide commands, not in the preview header', () => {
  const menu = html.slice(html.indexOf('id="toolbar-more"'), html.indexOf('</details>'));
  assert.match(menu, /id="btn-dark-mode"/);
  const previewHeader = html.slice(html.indexOf('class="preview-header"'), html.indexOf('id="preview-scroll"'));
  assert.doesNotMatch(previewHeader, /btn-dark-mode/);
});
