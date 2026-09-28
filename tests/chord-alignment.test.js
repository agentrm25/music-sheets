const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src-js/preview.js'), 'utf8');

function createApp(environment = {}) {
  const app = { VERSE_COLORS: ['#cc1800'], previewZoom: 60 };
  vm.runInNewContext(source, { window: { ChartApp: app }, ...environment });
  return app;
}

test('grid layout preserves typed spacing and excludes bold markup from lyric columns', () => {
  const app = createApp();
  const layout = app.getGridLineLayout(
    { chords: '  C     G', content: '  **Sing**  on', bold: false },
    { type: 'chorus' }, true, 532, 17.6
  );
  assert.equal(layout.rows.length, 1);
  assert.equal(layout.rows[0].chords, '  C     G');
  assert.equal(layout.rows[0].lyricSegments.map(segment => segment.text).join(''), '  Sing  on');
  assert.equal(layout.rows[0].lyricSegments.find(segment => segment.text === 'Sing').bold, true);
  assert.equal(layout.columns, 10);
  assert.equal(layout.fontSize, 17.6);
});

test('verse prefix advances both paired rows by the same number of columns', () => {
  const app = createApp();
  const line = { chords: 'C   G', content: 'Sing on', bold: false };
  const section = { type: 'verse', verseNumber: 12 };
  const first = app.getGridLineLayout(line, section, true, 532, 17.6);
  assert.equal(first.rows[0].chords, '     C   G');
  assert.equal(first.rows[0].lyricSegments.map(segment => segment.text).join(''), '[12] Sing on');
  assert.equal(first.rows[0].lyricSegments[0].verseNumber, true);
  assert.equal(first.rows[0].lyricSegments.every(segment => segment.bold), true);
  const next = app.getGridLineLayout(line, section, false, 532, 17.6);
  assert.equal(next.rows[0].chords, line.chords);
  assert.equal(next.rows[0].lyricSegments.map(segment => segment.text).join(''), line.content);
});

test('overlong pairs retain their column positions and fit without unreadable scaling', () => {
  const app = createApp();
  const chordCells = Array(250).fill(' ');
  chordCells[5] = 'C';
  chordCells[85] = 'G';
  chordCells[165] = 'D';
  const chords = chordCells.join('');
  const content = 'syllable '.repeat(28);
  const layout = app.getGridLineLayout({ chords, content, bold: false }, { type: 'chorus' }, true, 532, 26.4);
  assert.ok(layout.rows.length > 1);
  assert.equal(layout.rows.map(row => row.chords).join(''), chords);
  assert.equal(layout.rows.flatMap(row => row.lyricSegments.map(segment => segment.text)).join(''), content);
  assert.ok(layout.fontSize >= 26.4 * 0.6);
  let startColumn = 0;
  for (const row of layout.rows) {
    assert.ok(row.columns * layout.fontSize * 0.6 <= 532 + 0.001);
    for (const chord of ['C', 'G', 'D']) {
      if (row.chords.includes(chord)) {
        assert.equal(startColumn + row.chords.indexOf(chord), chords.indexOf(chord));
      }
    }
    startColumn += row.columns;
  }
});

test('pasted tabs expand consistently in both grid rows', () => {
  const app = createApp();
  const layout = app.getGridLineLayout(
    { chords: 'C\tG', content: 'a\tb', bold: false }, { type: 'chorus' }, true, 532, 17.6
  );
  assert.equal(layout.rows[0].chords, 'C   G');
  assert.equal(layout.rows[0].lyricSegments.map(segment => segment.text).join(''), 'a   b');
});

test('plain-text import retains leading chord and lyric spaces before pairing rows', () => {
  const app = createApp();
  app.createSection = type => ({ type, lines: [] });
  app.createLine = (type, content, bold = false) => ({ type, content, bold });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src-js/import-export.js'), 'utf8'), {
    window: { ChartApp: app }
  });
  const [section] = app.parseImportText('[Chorus]\n  C       G\n    Sing on\n');
  assert.equal(section.lines.length, 1);
  assert.equal(section.lines[0].type, 'grid');
  assert.equal(section.lines[0].chords, '  C       G');
  assert.equal(section.lines[0].content, '    Sing on');
  const layout = app.getGridLineLayout(section.lines[0], section, true, 532, 17.6);
  assert.equal(layout.rows[0].chords.indexOf('C'), 2);
  assert.equal(layout.rows[0].lyricSegments[0].text.indexOf('Sing'), 4);
});

test('preview fit follows available width, respects manual zoom and recovers after hiding', () => {
  const elements = {
    'chart-paper': { offsetWidth: 612, style: {} },
    'chart-wrapper': { style: {} },
    'preview-scroll': { clientWidth: 400, style: { paddingLeft: '24px', paddingRight: '24px' } },
    'zoom-level': { textContent: '' }
  };
  const app = createApp({
    document: { getElementById: id => elements[id] },
    getComputedStyle: element => element.style
  });
  app.fitPreview();
  assert.equal(app.previewZoom, 57);
  assert.equal(elements['chart-paper'].style.zoom, 0.57);
  assert.equal(elements['zoom-level'].textContent, '57%');
  elements['preview-scroll'].clientWidth = 1000;
  app.applyZoom();
  assert.equal(app.previewZoom, 100, 'automatic fit should not enlarge beyond actual size');
  app.previewAutoFit = false;
  app.previewZoom = 80;
  elements['preview-scroll'].clientWidth = 360;
  app.applyZoom();
  assert.equal(app.previewZoom, 80, 'manual zoom should survive a resize');
  elements['preview-scroll'].clientWidth = 0;
  app.fitPreview();
  assert.equal(app.previewZoom, 80, 'a hidden panel has no usable width to fit');
  elements['preview-scroll'].clientWidth = 360;
  app.applyZoom();
  assert.equal(app.previewZoom, 50, 'fit resumes when the preview becomes visible');
});

test('zoom controls share one range and disable at its ends', () => {
  const elements = {
    'chart-paper': { offsetWidth: 612, style: {} },
    'chart-wrapper': { style: {} },
    'preview-scroll': { clientWidth: 60, style: { paddingLeft: '0px', paddingRight: '0px' } },
    'zoom-level': { textContent: '' },
    'btn-zoom-in': { disabled: false },
    'btn-zoom-out': { disabled: false }
  };
  const app = createApp({
    document: { getElementById: id => elements[id] },
    getComputedStyle: element => element.style
  });
  app.fitPreview();
  assert.equal(app.previewZoom, app.ZOOM_MIN, 'fit never shrinks below the manual minimum');
  assert.equal(elements['btn-zoom-out'].disabled, true);
  assert.equal(elements['btn-zoom-in'].disabled, false);
  app.previewAutoFit = false;
  app.previewZoom = app.ZOOM_MAX;
  app.applyZoom();
  assert.equal(elements['btn-zoom-in'].disabled, true);
  assert.equal(elements['btn-zoom-out'].disabled, false);
});
