const test = require('node:test');
const assert = require('node:assert/strict');
const { jsPDF } = require('../jspdf.umd.min.js');

test('PDF grid chords and lyrics use Helvetica', async () => {
  const renderedText = [];

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
        y: args[2]
      });
      return drawText(...args);
    };

    pdf.save = () => {};
    return pdf;
  }

  const app = {
    state: {
      title: '',
      artist: '',
      bpm: '',
      timeSignature: '',
      key: '',
      originalKey: '',
      capo: '',
      arrangementNotes: '',
      sections: [{
        type: 'chorus',
        repeat: null,
        fontScale: 150,
        lines: [
          { type: 'grid', chords: 'C#, B', content: 'Fresh Air', bold: false },
          { type: 'blank', content: '', bold: false },
          { type: 'lyric', content: 'Later', bold: false }
        ]
      }]
    },
    SECTION_META: {
      chorus: { label: 'CHORUS', color: '#248018' },
      custom: { label: 'SECTION', color: '#000000' }
    },
    getLyricRenderInfo(line) {
      return {
        fullText: line.content,
        isVerseFirst: false,
        isBold: line.bold,
        vNumColor: '#000000',
        vNumText: ''
      };
    },
    parseInlineBold(text) {
      return [{ text, bold: false }];
    },
    normalizeSectionFontScale(value) {
      return value || 100;
    },
    showToast() {}
  };

  global.window = {
    ChartApp: app,
    jspdf: { jsPDF: InspectableJsPDF }
  };

  const modulePath = require.resolve('../src-js/import-export.js');
  delete require.cache[modulePath];
  require(modulePath);

  await app.exportPDF();

  const chord = renderedText.find(entry => entry.text === 'C#, B');
  const lyric = renderedText.find(entry => entry.text === 'Fresh Air');

  assert.equal(chord?.fontName, 'helvetica');
  assert.equal(chord?.fontStyle, 'bold');
  assert.equal(chord?.fontSize, 24);
  assert.equal(lyric?.fontName, 'helvetica');
  assert.equal(lyric?.fontStyle, 'normal');
  assert.ok(Math.abs(lyric.fontSize - 26.4) < 0.001);

  const later = renderedText.find(entry => entry.text === 'Later');
  assert.ok(later.y - lyric.y > 60, 'blank line should add vertical PDF space');
});
