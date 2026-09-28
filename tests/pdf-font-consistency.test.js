const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { jsPDF } = require('../jspdf.umd.min.js');

async function renderPDF(lines, sectionOptions = {}) {
  const renderedText = [];
  const errors = [];
  function InspectableJsPDF(options) {
    const pdf = new jsPDF(options);
    const drawText = pdf.text.bind(pdf);
    pdf.text = (...args) => {
      const font = pdf.getFont();
      renderedText.push({
        text: args[0],
        fontName: font.fontName,
        fontStyle: font.fontStyle,
        fontSize: pdf.getFontSize(),
        x: args[1],
        y: args[2],
        width: typeof args[0] === 'string' ? pdf.getTextWidth(args[0]) : 0,
        page: pdf.internal.getCurrentPageInfo().pageNumber
      });
      return drawText(...args);
    };
    pdf.save = () => {};
    return pdf;
  }
  const app = {
    state: {
      title: '', artist: '', bpm: '', timeSignature: '', key: '', originalKey: '',
      capo: '', arrangementNotes: '',
      sections: [{ type: 'chorus', fontScale: 150, ...sectionOptions, lines }]
    },
    SECTION_META: {
      chorus: { label: 'CHORUS', color: '#248018' },
      verse: { label: '', color: '#cc1800' },
      custom: { label: 'SECTION', color: '#000000' }
    },
    VERSE_COLORS: ['#cc1800'],
    normalizeSectionFontScale: value => value || 100,
    showToast(message, type) { if (type === 'error') errors.push(message); }
  };
  const context = vm.createContext({ window: { ChartApp: app, jspdf: { jsPDF: InspectableJsPDF } }, console });
  for (const file of ['preview.js', 'import-export.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src-js', file), 'utf8'), context);
  }
  await app.exportPDF();
  assert.deepEqual(errors, [], 'PDF export should complete without an error toast');
  return renderedText;
}

test('PDF grid rows share Courier metrics while standalone rows retain Helvetica', async () => {
  const renderedText = await renderPDF([
    { type: 'grid', chords: 'C#    B', content: 'Fresh Air', bold: false },
    { type: 'blank', content: '', bold: false },
    { type: 'lyric', content: 'Later', bold: false },
    { type: 'chord', content: 'Am', bold: false }
  ]);
  const chord = renderedText.find(entry => entry.text === 'C#    B');
  const lyric = renderedText.find(entry => entry.text === 'Fresh Air');
  assert.equal(chord?.fontName, 'courier');
  assert.equal(chord.fontStyle, 'bold');
  assert.equal(lyric?.fontName, 'courier');
  assert.equal(lyric.fontStyle, 'normal');
  assert.equal(chord.fontSize, lyric.fontSize);
  assert.ok(Math.abs(lyric.fontSize - 26.4) < 0.001);
  assert.equal(chord.x, lyric.x, 'unequal text lengths must not center independently');
  const later = renderedText.find(entry => entry.text === 'Later');
  assert.equal(later.fontName, 'helvetica');
  assert.ok(later.y - lyric.y > 60, 'blank line should add vertical PDF space');
  const standaloneChord = renderedText.find(entry => entry.text === 'Am');
  assert.equal(standaloneChord.fontName, 'helvetica');
  assert.equal(standaloneChord.fontSize, 24);
});

test('PDF verse labels reserve equal chord space and inline bold does not change columns', async () => {
  const renderedText = await renderPDF([
    { type: 'grid', chords: 'C     G', content: '**Sing**  on', bold: false }
  ], { type: 'verse', verseNumber: 12 });
  const chord = renderedText.find(entry => entry.text === '     C     G');
  const prefix = renderedText.find(entry => entry.text === '[12] ');
  const lyric = renderedText.find(entry => entry.text === 'Sing  on');
  assert.ok(chord && prefix && lyric);
  assert.equal(chord.x, prefix.x);
  assert.ok(Math.abs(lyric.x - chord.x - 5 * chord.fontSize * 0.6) < 0.001);
  assert.equal(lyric.fontStyle, 'bold');
  assert.equal(chord.page, lyric.page);
});

test('long PDF grid rows wrap together within margins and stay paired across pages', async () => {
  const chords = 'C       G       '.repeat(150);
  const content = 'words   phrases '.repeat(150);
  const renderedText = await renderPDF([{ type: 'grid', chords, content, bold: false }]);
  const gridText = renderedText.filter(entry => entry.fontName === 'courier');
  assert.ok(gridText.length > 20, 'the long input should produce multiple paired chunks');
  assert.ok(new Set(gridText.map(entry => entry.page)).size > 1, 'exercise a PDF page boundary');
  const chordChunks = [];
  const lyricChunks = [];
  for (let index = 0; index < gridText.length; index += 2) {
    const chord = gridText[index];
    const lyric = gridText[index + 1];
    assert.ok(lyric, 'every chord chunk has its lyric chunk');
    assert.equal(chord.page, lyric.page, 'a page break must not separate a pair');
    assert.equal(chord.x, lyric.x);
    assert.equal(chord.fontSize, lyric.fontSize);
    assert.ok(chord.fontSize >= 26.4 * 0.6, 'wrapping preserves the minimum readable scale');
    for (const row of [chord, lyric]) {
      assert.ok(row.x >= 40 - 0.001);
      assert.ok(row.x + row.width <= 572 + 0.001, 'text must fit inside the PDF right margin');
      assert.ok(row.y <= 748, 'text must fit above the page footer');
    }
    chordChunks.push(chord.text);
    lyricChunks.push(lyric.text);
  }
  assert.equal(chordChunks.join(''), chords, 'wrapping preserves every chord and space');
  assert.equal(lyricChunks.join(''), content, 'wrapping preserves every lyric and space');
});
