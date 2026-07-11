(function(app) {
  'use strict';

  app.parseImportText = function(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;

    const CHORD_LINE_RE = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|dom|7|9|11|13|\d)*(?:\s*[-,\/\s]\s*[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|dom|7|9|11|13|\d)*)*\s*$/;
    const SECTION_RE = /^\[(.+?)\]\s*(.*)$/;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const sectionMatch = trimmed.match(SECTION_RE);
      if (sectionMatch) {
        const label = sectionMatch[1];
        const rest = sectionMatch[2].trim();

        let type = 'custom';
        let verseNumber = null;
        let customLabel = label;
        let repeat = null;

        const lowerLabel = label.toLowerCase();
        if (lowerLabel === 'intro') { type = 'intro'; customLabel = ''; }
        else if (lowerLabel === 'chorus') { type = 'chorus'; customLabel = ''; }
        else if (lowerLabel === 'bridge') { type = 'bridge'; customLabel = ''; }
        else if (lowerLabel === 'outro') { type = 'outro'; customLabel = ''; }
        else if (lowerLabel === 'instrumental') { type = 'instrumental'; customLabel = ''; }
        else if (/^\d+$/.test(label)) {
          type = 'verse';
          verseNumber = parseInt(label);
          customLabel = '';
        }

        const repeatMatch = rest.match(/x(\d+)/i);
        if (repeatMatch) repeat = parseInt(repeatMatch[1]);

        currentSection = app.createSection(type);
        currentSection.verseNumber = verseNumber;
        currentSection.customLabel = customLabel;
        currentSection.repeat = repeat;
        sections.push(currentSection);

        const afterRepeat = rest.replace(/x\d+/i, '').trim();
        if (afterRepeat) {
          currentSection.lines.push(app.createLine('lyric', afterRepeat, true));
        }
        continue;
      }

      if (!currentSection) {
        currentSection = app.createSection('verse');
        currentSection.verseNumber = 1;
        sections.push(currentSection);
      }

      if (CHORD_LINE_RE.test(trimmed)) {
        currentSection.lines.push(app.createLine('chord', trimmed));
      } else {
        if (/^\(.+\)$/.test(trimmed) || /^Capo|^Key:|^BPM/i.test(trimmed)) {
          currentSection.lines.push(app.createLine('instruction', trimmed));
        } else {
          currentSection.lines.push(app.createLine('lyric', trimmed));
        }
      }
    }

    sections.forEach(section => {
      const merged = [];
      for (let i = 0; i < section.lines.length; i++) {
        const line = section.lines[i];
        if (line.type === 'chord' && i + 1 < section.lines.length && section.lines[i + 1].type === 'lyric') {
          const gridLine = app.createLine('grid', section.lines[i + 1].content, section.lines[i + 1].bold);
          gridLine.chords = line.content;
          merged.push(gridLine);
          i++;
        } else {
          merged.push(line);
        }
      }
      section.lines = merged;
    });

    return sections;
  };

  app.exportJSON = function() {
    const data = JSON.stringify(app.state, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (app.state.title || 'chart').replace(/[^a-zA-Z0-9 ]/g, '').trim() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    app.showToast('JSON saved', 'success');
  };

  app.importJSON = async function(file) {
    try {
      const text = await file.text();
      let hasEncodingIssue = false;
      if (text.includes('\uFFFD')) {
        hasEncodingIssue = true;
        console.warn('File contains replacement characters (\uFFFD). Original encoding may have been incorrect.');
      }
      
      const data = JSON.parse(text);
      if (data && Array.isArray(data.sections) && data.sections.every(s => s && s.id && s.type && Array.isArray(s.lines))) {
        app.pushUndo();
        app.state = app.normalizeState(data);
        app.syncFormFromState();
        app.renderEditor();
        app.renderPreview();
        app.autoSave();
        
        if (hasEncodingIssue) {
          app.showToast(`Loaded "${data.title || 'chart'}" with some encoding warnings`, 'info');
        } else {
          app.showToast(`Loaded "${data.title || 'chart'}"`, 'success');
        }
      } else {
        app.showToast('Invalid chart file structure', 'error');
      }
    } catch (err) {
      console.error('Import parse error:', err);
      app.showToast('Failed to parse file: ' + err.message, 'error');
    }
  };

  app.exportPDF = async function() {
    app.showToast('Generating PDF…', 'info');

    try {
      const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFClass) {
        app.showToast('PDF library (jsPDF) is not loaded. Please check your internet connection.', 'error');
        return;
      }

      const pageWidth = 612;
      const pageHeight = 792;
      const marginX = 40;
      const marginY = 24;
      const usableWidth = pageWidth - marginX * 2;
      const pageNumAreaHeight = 20;
      const usableHeight = pageHeight - marginY - pageNumAreaHeight;

      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });

      let y = marginY;

      function checkPageBreak(neededHeight) {
        if (y + neededHeight > usableHeight) {
          pdf.addPage();
          y = marginY;
          return true;
        }
        return false;
      }

      function setColor(colorHex) {
        if (!colorHex) colorHex = '#000000';
        let hex = colorHex.replace('#', '');
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        pdf.setTextColor(r, g, b);
      }

      function getScaledFontSize(text, baseSize) {
        pdf.setFontSize(baseSize);
        const cleanText = text.replace(/\*\*/g, '');
        const textWidth = pdf.getTextWidth(cleanText);
        if (textWidth > usableWidth) {
          const scale = usableWidth / textWidth;
          return Math.max(scale, 0.6) * baseSize;
        }
        return baseSize;
      }

      function drawTextWithInlineBold(text, x, curY, baseBold, align) {
        if (!text.includes('**')) {
          pdf.setFont('helvetica', baseBold ? 'bold' : 'normal');
          if (align === 'center') {
            pdf.text(text, x, curY, { align: 'center' });
          } else {
            pdf.text(text, x, curY);
          }
          return;
        }

        const segments = app.parseInlineBold(text);
        let totalWidth = 0;
        segments.forEach(seg => {
          if (seg.text === '') return;
          const isBold = baseBold ? !seg.bold : seg.bold;
          pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          totalWidth += pdf.getTextWidth(seg.text);
        });

        let curX = x;
        if (align === 'center') {
          curX = x - totalWidth / 2;
        }

        segments.forEach(seg => {
          if (seg.text === '') return;
          const isBold = baseBold ? !seg.bold : seg.bold;
          pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          pdf.text(seg.text, curX, curY);
          curX += pdf.getTextWidth(seg.text);
        });
      }

      const lineHeightMultiplier = 1.35;
      const lyricFontSize = 17.6;
      const chordFontSize = 16;
      const instructionFontSize = 15.5;
      const sectionHeaderFontSize = 17.5;

      if (app.state.title) {
        const titleText = `“${app.state.title}”`;
        const size = getScaledFontSize(titleText, lyricFontSize);
        const height = size * lineHeightMultiplier;
        checkPageBreak(height);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(titleText, pageWidth / 2, y + size, { align: 'center' });
        y += height;
      }

      if (app.state.artist) {
        const size = getScaledFontSize(app.state.artist, 14);
        const height = size * lineHeightMultiplier;
        checkPageBreak(height);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(app.state.artist, pageWidth / 2, y + size, { align: 'center' });
        y += height;
      }

      if (app.state.bpm || app.state.timeSignature) {
        const parts = [];
        if (app.state.bpm) parts.push(`${app.state.bpm} BPM`);
        if (app.state.timeSignature) parts.push(app.state.timeSignature);
        const bpmText = parts.join(' • ');
        const size = getScaledFontSize(bpmText, 12);
        const height = size * lineHeightMultiplier;
        checkPageBreak(height);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(bpmText, pageWidth / 2, y + size, { align: 'center' });
        y += height;
      }

      if (app.state.key) {
        let keyText = `Key: ${app.state.key}`;
        if (app.state.originalKey) {
          keyText += ` (originally in ${app.state.originalKey})`;
        }
        const size = getScaledFontSize(keyText, lyricFontSize);
        const height = size * lineHeightMultiplier;
        checkPageBreak(height);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(keyText, pageWidth / 2, y + size, { align: 'center' });
        y += height;
      }

      if (app.state.capo) {
        const capoText = `Capo - ${app.state.capo}`;
        const size = getScaledFontSize(capoText, lyricFontSize);
        const height = size * lineHeightMultiplier;
        checkPageBreak(height);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(capoText, pageWidth / 2, y + size, { align: 'center' });
        y += height;
      }

      if (app.state.arrangementNotes) {
        const size = instructionFontSize;
        const bracketLeft = marginX + 28;
        const bracketRight = pageWidth - marginX - 28;
        const bracketWidth = 9;
        const bracketPad = 14;
        const textWidth = bracketRight - bracketLeft - (bracketWidth + bracketPad) * 2;
        const lines = pdf.splitTextToSize(app.state.arrangementNotes, textWidth);
        const textHeight = size * lineHeightMultiplier * lines.length;
        const height = textHeight + 16;
        checkPageBreak(height);

        const top = y + 2;
        const bottom = y + height - 2;
        pdf.setDrawColor(102, 102, 102);
        pdf.setLineWidth(1.25);
        pdf.line(bracketLeft, top, bracketLeft, bottom);
        pdf.line(bracketLeft, top, bracketLeft + bracketWidth, top);
        pdf.line(bracketLeft, bottom, bracketLeft + bracketWidth, bottom);
        pdf.line(bracketRight, top, bracketRight, bottom);
        pdf.line(bracketRight - bracketWidth, top, bracketRight, top);
        pdf.line(bracketRight - bracketWidth, bottom, bracketRight, bottom);

        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(size);
        pdf.setTextColor(68, 68, 68);
        pdf.text(lines, pageWidth / 2, y + size + 6, { align: 'center' });
        y += height;
      }

      app.state.sections.forEach(section => {
        const meta = app.SECTION_META[section.type] || app.SECTION_META.custom;
        let headerText = meta.label;
        if (section.type === 'custom') headerText = (section.customLabel || 'SECTION').toUpperCase();
        if (section.repeat && section.type !== 'verse') headerText += ` × ${section.repeat}`;
        let headerColor = meta.color;

        const firstRenderedLine = section.lines.find(l => l.content || l.type === 'chord' || (l.type === 'grid' && l.chords));
        let firstLineHeight = 0;
        if (firstRenderedLine) {
          const info = app.getLyricRenderInfo(firstRenderedLine, section, true);
          if (firstRenderedLine.type === 'chord') {
            firstLineHeight = getScaledFontSize(firstRenderedLine.content, chordFontSize) * lineHeightMultiplier;
          } else if (firstRenderedLine.type === 'lyric') {
            firstLineHeight = getScaledFontSize(info.fullText, lyricFontSize) * lineHeightMultiplier;
          } else if (firstRenderedLine.type === 'instruction') {
            firstLineHeight = getScaledFontSize(firstRenderedLine.content, instructionFontSize) * lineHeightMultiplier;
          } else if (firstRenderedLine.type === 'grid') {
            let h = 0;
            if (firstRenderedLine.chords) h += getScaledFontSize(firstRenderedLine.chords, chordFontSize) * lineHeightMultiplier;
            if (firstRenderedLine.content) h += getScaledFontSize(info.fullText, lyricFontSize) * lineHeightMultiplier;
            firstLineHeight = h;
          }
        } else {
          firstLineHeight = lyricFontSize * lineHeightMultiplier;
        }

        const headerSize = getScaledFontSize(headerText || 'SECTION', sectionHeaderFontSize);
        const headerHeight = headerText ? (headerSize * lineHeightMultiplier) : 0;
        const spacerHeight = lyricFontSize * 1.0;

        if (y + spacerHeight + headerHeight + firstLineHeight > usableHeight) {
          pdf.addPage();
          y = marginY;
        } else {
          y += spacerHeight;
        }

        if (headerText) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(headerSize);
          setColor(headerColor);
          pdf.text(headerText, pageWidth / 2, y + headerSize, { align: 'center' });
          y += headerHeight;
        }

        let firstLyricInVerse = true;
        section.lines.forEach(line => {
          if (!line.content && !(line.type === 'chord' || (line.type === 'grid' && line.chords))) return;

          if (line.type === 'chord') {
            const size = getScaledFontSize(line.content, chordFontSize);
            const height = size * lineHeightMultiplier;
            checkPageBreak(height);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(size);
            setColor('#1a55d4');
            pdf.text(line.content, pageWidth / 2, y + size, { align: 'center' });
            y += height;
          } else if (line.type === 'lyric') {
            const info = app.getLyricRenderInfo(line, section, firstLyricInVerse);
            if (info.isVerseFirst) firstLyricInVerse = false;

            const size = getScaledFontSize(info.fullText, lyricFontSize);
            const height = size * lineHeightMultiplier;
            checkPageBreak(height);
            pdf.setFontSize(size);

            if (info.isVerseFirst) {
              const cleanFullText = info.fullText.replace(/\*\*/g, '');
              const totalW = pdf.getTextWidth(cleanFullText);
              let startX = (pageWidth - totalW) / 2;

              pdf.setFont('helvetica', 'bold');
              setColor(info.vNumColor);
              pdf.text(info.vNumText, startX, y + size);
              startX += pdf.getTextWidth(info.vNumText);

              setColor('#000000');
              drawTextWithInlineBold(line.content, startX, y + size, true, 'left');
            } else {
              pdf.setTextColor(0, 0, 0);
              drawTextWithInlineBold(line.content, pageWidth / 2, y + size, info.isBold, 'center');
            }
            y += height;
          } else if (line.type === 'instruction') {
            const size = getScaledFontSize(line.content, instructionFontSize);
            const height = size * lineHeightMultiplier;
            checkPageBreak(height);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(size);
            setColor('#cc00cc');
            pdf.text(line.content, pageWidth / 2, y + size, { align: 'center' });
            y += height;
          } else if (line.type === 'grid') {
            if (line.chords) {
              const size = getScaledFontSize(line.chords, chordFontSize);
              const height = size * lineHeightMultiplier;
              checkPageBreak(height);
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(size);
              setColor('#1a55d4');
              pdf.text(line.chords, pageWidth / 2, y + size, { align: 'center' });
              y += height;
            }

            if (line.content) {
              const info = app.getLyricRenderInfo(line, section, firstLyricInVerse);
              if (info.isVerseFirst) firstLyricInVerse = false;

              const size = getScaledFontSize(info.fullText, lyricFontSize);
              const height = size * lineHeightMultiplier;
              checkPageBreak(height);
              pdf.setFontSize(size);

              if (info.isVerseFirst) {
                const cleanFullText = info.fullText.replace(/\*\*/g, '');
                const totalW = pdf.getTextWidth(cleanFullText);
                let startX = (pageWidth - totalW) / 2;

                pdf.setFont('helvetica', 'bold');
                setColor(info.vNumColor);
                pdf.text(info.vNumText, startX, y + size);
                startX += pdf.getTextWidth(info.vNumText);

                setColor('#000000');
                drawTextWithInlineBold(line.content, startX, y + size, true, 'left');
              } else {
                pdf.setTextColor(0, 0, 0);
                drawTextWithInlineBold(line.content, pageWidth / 2, y + size, info.isBold, 'center');
              }
              y += height;
            }
          }
        });
      });

      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        const label = `${i} / ${totalPages}`;
        const textWidth = pdf.getTextWidth(label);
        pdf.text(label, pageWidth - 36 - textWidth, usableHeight + 13);
      }

      const filename = (app.state.title || 'chart').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'chart';
      pdf.save(`${filename}.pdf`);
      app.showToast('PDF exported!', 'success');

    } catch (err) {
      console.error('PDF export error:', err);
      app.showToast('PDF export failed: ' + err.message, 'error');
    }
  };

})(window.ChartApp = window.ChartApp || {});
