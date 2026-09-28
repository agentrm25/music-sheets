(function(app) {
  'use strict';

  app.parseInlineBold = function(content) {
    const segments = [];
    const re = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: content.slice(lastIndex, match.index), bold: false });
      }
      segments.push({ text: match[1], bold: true });
      lastIndex = re.lastIndex;
    }
    if (lastIndex < content.length) {
      segments.push({ text: content.slice(lastIndex), bold: false });
    }
    if (segments.length === 0) {
      segments.push({ text: content, bold: false });
    }
    return segments;
  };

  app.renderInlineBold = function(parentEl, content, baseBold) {
    const hasMarkers = content.includes('**');
    if (!hasMarkers) {
      parentEl.appendChild(document.createTextNode(content));
      return;
    }
    const segments = app.parseInlineBold(content);
    segments.forEach(seg => {
      if (seg.text === '') return;
      const span = document.createElement('span');
      span.textContent = seg.text;
      const isBold = baseBold || seg.bold;
      span.style.fontWeight = isBold ? '700' : '400';
      parentEl.appendChild(span);
    });
  };

  app.getLyricRenderInfo = function(line, section, isFirstLyricInVerse) {
    const isVerseFirst = section.type === 'verse' && isFirstLyricInVerse && line.content;
    const isBold = line.bold || isVerseFirst;
    const vNum = section.verseNumber || 1;
    
    let fullText = line.content;
    let vNumText = '';
    let vNumColor = '';
    
    if (isVerseFirst) {
      vNumText = `[${vNum}] `;
      fullText = vNumText + line.content;
      vNumColor = app.VERSE_COLORS[Math.min(vNum - 1, app.VERSE_COLORS.length - 1)];
    }
    
    return {
      isVerseFirst,
      isBold,
      vNum,
      vNumText,
      vNumColor,
      fullText,
      content: line.content
    };
  };

  app.renderPreviewLyricHTML = function(parentEl, line, section, isFirstLyricInVerse) {
    const info = app.getLyricRenderInfo(line, section, isFirstLyricInVerse);
    
    parentEl.className = info.isBold ? 'chart-lyric-bold' : 'chart-lyric-line';
    
    if (info.isVerseFirst) {
      const numSpan = document.createElement('span');
      numSpan.className = `chart-verse-number v${Math.min(info.vNum, 5)}`;
      numSpan.textContent = info.vNumText;
      parentEl.appendChild(numSpan);
    }
    
    app.renderInlineBold(parentEl, line.content, info.isBold);
    
    return info.isVerseFirst; // return whether we actually consumed the "first lyric" slot
  };

  // Courier has the same 0.6-em character advance in the browser and bundled PDF font.
  // Layout both rows as columns so centering, verse numbers, bold text and wrapping
  // cannot move a chord away from the lyric position entered by the musician.
  app.getGridLineLayout = function(line, section, isFirstLyricInVerse, availableWidth, baseFontSize) {
    const info = app.getLyricRenderInfo(line, section, isFirstLyricInVerse);
    const expandCells = segments => {
      const cells = [];
      segments.forEach(segment => {
        Array.from(segment.text).forEach(character => {
          const text = character === '\t' ? ' '.repeat(4 - cells.length % 4) : character;
          Array.from(text).forEach(value => cells.push({ ...segment, text: value }));
        });
      });
      return cells;
    };
    const prefix = Array.from(info.vNumText);
    const chordCells = [
      ...prefix.map(() => ({ text: ' ' })),
      ...expandCells([{ text: line.chords || '' }])
    ];
    const lyricCells = [
      ...prefix.map(text => ({ text, bold: true, verseNumber: true })),
      ...expandCells(app.parseInlineBold(line.content).map(segment => ({
        ...segment, bold: info.isBold || segment.bold
      })))
    ];
    const columnCount = Math.max(chordCells.length, lyricCells.length, 1);
    const width = Math.max(1, availableWidth);
    const maxColumns = Math.max(1, Math.floor(width / (baseFontSize * 0.6 * 0.6)));
    const isBoundary = (cells, index) => !cells[index] || !cells[index - 1] ||
      /\s/.test(cells[index].text) || /\s/.test(cells[index - 1].text);
    const rows = [];

    for (let start = 0; start < columnCount;) {
      const limit = Math.min(start + maxColumns, columnCount);
      let end = limit;
      if (limit < columnCount) {
        // Prefer a shared word boundary; keep both rows on exactly the same columns.
        const earliest = start + Math.max(1, Math.floor(maxColumns / 2));
        while (end > earliest && !(isBoundary(chordCells, end) && isBoundary(lyricCells, end))) end--;
        if (!(isBoundary(chordCells, end) && isBoundary(lyricCells, end))) end = limit;
      }
      const lyricSegments = [];
      lyricCells.slice(start, end).forEach(cell => {
        const previous = lyricSegments[lyricSegments.length - 1];
        if (previous && previous.bold === cell.bold && previous.verseNumber === cell.verseNumber) {
          previous.text += cell.text;
        } else {
          lyricSegments.push({ ...cell });
        }
      });
      rows.push({
        chords: chordCells.slice(start, end).map(cell => cell.text).join(''),
        lyricSegments,
        columns: end - start
      });
      start = end;
    }

    const columns = Math.max(...rows.map(row => row.columns));
    return {
      ...info,
      rows,
      columns,
      fontSize: Math.min(baseFontSize, width / (columns * 0.6)),
      hasChords: Boolean(line.chords),
      hasLyrics: Boolean(line.content)
    };
  };

  app.renderPreview = function() {
    if (previewFrame !== null) {
      cancelFrame(previewFrame);
      previewFrame = null;
    }
    const paper = document.getElementById('chart-paper');
    if (!paper) return;
    paper.innerHTML = '';
    const paperStyle = getComputedStyle(paper);
    const gridWidth = (paper.clientWidth || 612) -
      (parseFloat(paperStyle.paddingLeft) || 40) - (parseFloat(paperStyle.paddingRight) || 40);

    if (app.state.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'chart-title';
      titleEl.textContent = `\u201C${app.state.title}\u201D`;
      paper.appendChild(titleEl);
    }

    if (app.state.artist) {
      const artistEl = document.createElement('div');
      artistEl.className = 'chart-artist';
      artistEl.textContent = app.state.artist;
      paper.appendChild(artistEl);
    }

    if (app.state.bpm || app.state.timeSignature) {
      const parts = [];
      if (app.state.bpm) parts.push(`${app.state.bpm} BPM`);
      if (app.state.timeSignature) parts.push(app.state.timeSignature);
      const bpmEl = document.createElement('div');
      bpmEl.className = 'chart-bpm';
      bpmEl.textContent = parts.join(' • ');
      paper.appendChild(bpmEl);
    }

    if (app.state.key && app.state.originalKey) {
      const keyEl = document.createElement('div');
      keyEl.className = 'chart-key-info';
      keyEl.textContent = `Key: ${app.state.key}`;
      paper.appendChild(keyEl);
      const origEl = document.createElement('div');
      origEl.className = 'chart-meta';
      origEl.textContent = `(originally in ${app.state.originalKey})`;
      origEl.style.marginBottom = '12px';
      paper.appendChild(origEl);
    } else if (app.state.key) {
      const keyEl = document.createElement('div');
      keyEl.className = 'chart-key-info';
      keyEl.textContent = `Key: ${app.state.key}`;
      paper.appendChild(keyEl);
    }

    if (app.state.capo) {
      const capoEl = document.createElement('div');
      capoEl.className = 'chart-meta';
      capoEl.textContent = `Capo - ${app.state.capo}`;
      capoEl.style.marginBottom = '12px';
      paper.appendChild(capoEl);
    }

    if (app.state.arrangementNotes) {
      const notesEl = document.createElement('div');
      notesEl.className = 'arrangement-notes';
      notesEl.textContent = app.state.arrangementNotes;
      paper.appendChild(notesEl);
    }

    app.state.sections.forEach((section) => {
      const spacer = document.createElement('div');
      spacer.className = 'chart-section-spacer';
      paper.appendChild(spacer);

      const sectionEl = document.createElement('div');
      sectionEl.className = 'chart-section';
      const fontScale = app.normalizeSectionFontScale(section.fontScale) / 100;
      sectionEl.style.setProperty('--section-label-size', `${17.5 * fontScale}px`);
      sectionEl.style.setProperty('--section-chord-size', `${16 * fontScale}px`);
      sectionEl.style.setProperty('--section-lyric-size', `${17.6 * fontScale}px`);
      sectionEl.style.setProperty('--section-line-height', `${17.6 * fontScale * 1.35}px`);
      sectionEl.style.setProperty('--section-instruction-size', `${15.5 * fontScale}px`);

      const meta = app.SECTION_META[section.type] || app.SECTION_META.custom;
      let headerText = meta.label;
      if (section.type === 'custom') headerText = (section.customLabel || 'SECTION').toUpperCase();

      if (section.repeat && section.type !== 'verse') {
        headerText += ` × ${section.repeat}`;
      }

      if (headerText) {
        const label = document.createElement('div');
        label.className = `chart-section-label ${section.type}`;
        label.textContent = headerText;
        sectionEl.appendChild(label);
      }

      let firstLyricInVerse = true;
      section.lines.forEach(line => {
        if (line.type === 'blank') {
          const blankEl = document.createElement('div');
          blankEl.className = 'chart-blank-line';
          blankEl.setAttribute('aria-hidden', 'true');
          sectionEl.appendChild(blankEl);
          return;
        }
        if (!line.content && !(line.type === 'chord' || (line.type === 'grid' && line.chords))) return;

        if (line.type === 'chord') {
          const chordEl = document.createElement('div');
          chordEl.className = 'chart-chord-line';
          chordEl.textContent = line.content;
          sectionEl.appendChild(chordEl);
        } else if (line.type === 'lyric') {
          const lyricEl = document.createElement('div');
          if (app.renderPreviewLyricHTML(lyricEl, line, section, firstLyricInVerse)) {
            firstLyricInVerse = false;
          }
          sectionEl.appendChild(lyricEl);
        } else if (line.type === 'instruction') {
          const instrEl = document.createElement('div');
          instrEl.className = 'chart-instruction';
          instrEl.textContent = line.content;
          sectionEl.appendChild(instrEl);
        } else if (line.type === 'grid') {
          const layout = app.getGridLineLayout(line, section, firstLyricInVerse, gridWidth, 17.6 * fontScale);
          if (layout.isVerseFirst) firstLyricInVerse = false;
          const gridEl = document.createElement('div');
          gridEl.className = 'chart-grid-line chart-aligned-grid';
          gridEl.style.setProperty('--grid-font-size', `${layout.fontSize}px`);
          layout.rows.forEach(row => {
            const pair = document.createElement('div');
            pair.className = 'chart-grid-pair';
            if (layout.hasChords) {
              const chordRow = document.createElement('div');
              chordRow.className = 'chart-chord-line';
              chordRow.textContent = row.chords;
              pair.appendChild(chordRow);
            }
            if (layout.hasLyrics) {
              const lyricRow = document.createElement('div');
              lyricRow.className = layout.isBold ? 'chart-lyric-bold' : 'chart-lyric-line';
              row.lyricSegments.forEach(segment => {
                const span = document.createElement('span');
                span.textContent = segment.text;
                span.style.fontWeight = segment.bold ? '700' : '400';
                if (segment.verseNumber) span.className = `chart-verse-number v${Math.min(layout.vNum, 5)}`;
                lyricRow.appendChild(span);
              });
              pair.appendChild(lyricRow);
            }
            gridEl.appendChild(pair);
          });
          sectionEl.appendChild(gridEl);
        }
      });

      paper.appendChild(sectionEl);
    });

    if (!app.state.title && app.state.sections.length === 0) {
      paper.innerHTML = `
        <div class="chart-empty-placeholder">
          Your chart preview<br>will appear here
        </div>
      `;
    }

    app.autoScaleLines(paper);
    app.applyZoom();

    paper.querySelectorAll('.page-break-indicator').forEach(el => el.remove());
    const scale = app.previewZoom / 100 || 1;
    const unzoomedWidth = paper.clientWidth / scale;
    const paddingV = parseFloat(getComputedStyle(paper).paddingTop) + parseFloat(getComputedStyle(paper).paddingBottom) || 48;
    const pageHeight = (792 / 612) * (unzoomedWidth - paddingV);
    const totalHeight = paper.scrollHeight / scale;

    if (totalHeight > pageHeight) {
      const numBreaks = Math.floor(totalHeight / pageHeight);
      for (let i = 1; i <= numBreaks; i++) {
        const breakLine = document.createElement('div');
        breakLine.className = 'page-break-indicator';
        breakLine.style.top = `${i * pageHeight}px`;
        paper.appendChild(breakLine);
      }
    }
  };

  app.autoScaleLines = function(paper) {
    const style = getComputedStyle(paper);
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const availableWidth = paper.clientWidth - padLeft - padRight;
    if (availableWidth <= 0) return;

    const LINE_SELECTOR = '.chart-chord-line, .chart-lyric-line, .chart-lyric-bold, .chart-instruction';
    const lines = Array.from(paper.querySelectorAll(LINE_SELECTOR))
      .filter(el => !el.closest('.chart-aligned-grid'));

    // Batch reads and writes so measuring N lines costs one layout, not N.
    const measured = lines
      .map(el => ({ el, fontSize: parseFloat(getComputedStyle(el).fontSize), whiteSpace: el.style.whiteSpace }))
      .filter(item => item.fontSize);
    measured.forEach(item => { item.el.style.whiteSpace = 'nowrap'; });
    measured.forEach(item => { item.scale = availableWidth / item.el.scrollWidth; });
    measured.forEach(item => {
      if (item.scale < 1) item.el.style.fontSize = `${item.fontSize * Math.max(item.scale, 0.6)}px`;
      item.el.style.whiteSpace = item.whiteSpace || '';
    });
  };

  // Coalesce preview rebuilds triggered while typing into one per frame.
  let previewFrame = null;
  const requestFrame = callback => (typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : setTimeout(callback, 16));
  const cancelFrame = id => (typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame(id)
    : clearTimeout(id));

  app.schedulePreview = function() {
    if (previewFrame !== null) return;
    previewFrame = requestFrame(() => {
      previewFrame = null;
      app.renderPreview();
    });
  };

  app.ZOOM_MIN = 25;
  app.ZOOM_MAX = 200;
  app.ZOOM_STEP = 10;

  app.fitPreview = function() {
    app.previewAutoFit = true;
    app.applyZoom();
  };

  app.applyZoom = function() {
    const chartPaper = document.getElementById('chart-paper');
    const chartWrapper = document.getElementById('chart-wrapper');
    if (!chartPaper || !chartWrapper) return;
    if (app.previewAutoFit !== false) {
      const scroll = document.getElementById('preview-scroll');
      if (scroll && scroll.clientWidth > 0) {
        const scrollStyle = getComputedStyle(scroll);
        const availableWidth = scroll.clientWidth - (parseFloat(scrollStyle.paddingLeft) || 0) -
          (parseFloat(scrollStyle.paddingRight) || 0);
        const paperWidth = chartPaper.offsetWidth || parseFloat(getComputedStyle(chartPaper).width) || 612;
        if (availableWidth > 0) {
          app.previewZoom = Math.max(app.ZOOM_MIN, Math.min(100, Math.floor(availableWidth / paperWidth * 100)));
        }
      }
    }
    const scale = app.previewZoom / 100;
    chartPaper.style.zoom = scale;
    chartPaper.style.transform = '';
    chartPaper.style.transformOrigin = '';
    chartWrapper.style.height = '';
    chartWrapper.style.width = '';
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) zoomLevel.textContent = `${app.previewZoom}%`;
    const zoomIn = document.getElementById('btn-zoom-in');
    const zoomOut = document.getElementById('btn-zoom-out');
    if (zoomIn) zoomIn.disabled = app.previewZoom >= app.ZOOM_MAX;
    if (zoomOut) zoomOut.disabled = app.previewZoom <= app.ZOOM_MIN;
  };

})(window.ChartApp = window.ChartApp || {});
