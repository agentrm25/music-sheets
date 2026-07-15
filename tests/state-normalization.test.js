const test = require('node:test');
const assert = require('node:assert/strict');

function loadApp() {
  const statePath = require.resolve('../src-js/state.js');
  const importExportPath = require.resolve('../src-js/import-export.js');

  delete require.cache[statePath];
  delete require.cache[importExportPath];

  global.window = { ChartApp: {} };
  require(statePath);
  require(importExportPath);

  return global.window.ChartApp;
}

test('numeric helpers reject blank and malformed values', () => {
  const app = loadApp();

  for (const value of ['', '   ', null, undefined, '12x', Infinity, -Infinity, NaN, 'Infinity']) {
    assert.equal(app.normalizeIntegerInRange(value, 1, 99), null, String(value));
  }
});

test('numeric helpers truncate finite fractions and clamp to field limits', () => {
  const app = loadApp();

  assert.equal(app.normalizeIntegerInRange('12.9', 1, 99), 12);
  assert.equal(app.normalizeBpm('5'), 20);
  assert.equal(app.normalizeBpm(301), 300);
  assert.equal(app.normalizeVerseNumber('0'), 1);
  assert.equal(app.normalizeVerseNumber(100), 99);
  assert.equal(app.normalizeRepeat('-4'), 1);
  assert.equal(app.normalizeRepeat('999'), 99);
});

test('createSection initializes an empty editor height', () => {
  const app = loadApp();

  assert.equal(app.createSection('chorus').editorHeight, '');
});

test('createSection keeps auto-numbered verses within the documented limit', () => {
  const app = loadApp();

  const section = app.createSection('verse', [
    { type: 'verse', verseNumber: 98 },
    { type: 'verse', verseNumber: 99 }
  ]);

  assert.equal(section.verseNumber, 99);
});

test('normalizeState replaces non-string, blank, and oversized identities', () => {
  const app = loadApp();
  const normalized = app.normalizeState({
    id: 123,
    sections: [{
      id: '   ',
      type: 'verse',
      lines: [{ id: 'x'.repeat(101), type: 'lyric', content: '' }]
    }]
  });

  assert.equal(typeof normalized.id, 'string');
  assert.equal(typeof normalized.sections[0].id, 'string');
  assert.equal(typeof normalized.sections[0].lines[0].id, 'string');
  assert.notEqual(normalized.id, '123');
  assert.notEqual(normalized.sections[0].id, '');
  assert.ok(new TextEncoder().encode(normalized.sections[0].lines[0].id).length <= 100);
});

test('normalizeState coerces bounded numeric strings', () => {
  const app = loadApp();
  const normalized = app.normalizeState({
    bpm: '301.8',
    sections: [{
      type: 'verse',
      verseNumber: '4.9',
      repeat: '0',
      lines: []
    }]
  });

  assert.equal(normalized.bpm, 300);
  assert.equal(normalized.sections[0].verseNumber, 4);
  assert.equal(normalized.sections[0].repeat, 1);
});

test('normalizeState rejects invalid numeric values', () => {
  const app = loadApp();
  const normalized = app.normalizeState({
    bpm: '120x',
    sections: [{
      type: 'verse',
      verseNumber: 'Infinity',
      repeat: '',
      lines: []
    }]
  });

  assert.equal(normalized.bpm, null);
  assert.equal(normalized.sections[0].verseNumber, null);
  assert.equal(normalized.sections[0].repeat, null);
});

test('normalizeState preserves only pixel editor heights', () => {
  const app = loadApp();
  const normalized = app.normalizeState({
    sections: [
      { editorHeight: '240px', lines: [] },
      { editorHeight: '18.5px', lines: [] },
      { editorHeight: '240', lines: [] },
      { editorHeight: 'calc(100vh)', lines: [] },
      { editorHeight: 240, lines: [] }
    ]
  });

  assert.deepEqual(
    normalized.sections.map(section => section.editorHeight),
    ['240px', '18.5px', '', '', '']
  );
});

test('parseImportText clamps verse and repeat markers with shared helpers', () => {
  const app = loadApp();
  const [high, low] = app.parseImportText('[999] x999\nHigh\n[0] x0\nLow');

  assert.equal(high.verseNumber, 99);
  assert.equal(high.repeat, 99);
  assert.equal(low.verseNumber, 1);
  assert.equal(low.repeat, 1);
});
