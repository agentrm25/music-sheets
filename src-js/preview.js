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

  app.renderPreview = function() {
    const paper = document.getElementById('chart-paper');
    if (!paper) return;
    paper.innerHTML = '';

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
          const gridEl = document.createElement('div');
          gridEl.className = 'chart-grid-line';
          if (line.chords) {
            const chordRow = document.createElement('div');
            chordRow.className = 'chart-chord-line';
            chordRow.textContent = line.chords;
            gridEl.appendChild(chordRow);
          }
          if (line.content) {
            const lyricRow = document.createElement('div');
            if (app.renderPreviewLyricHTML(lyricRow, line, section, firstLyricInVerse)) {
              firstLyricInVerse = false;
            }
            gridEl.appendChild(lyricRow);
          }
          sectionEl.appendChild(gridEl);
        }
      });

      paper.appendChild(sectionEl);
    });

    if (!app.state.title && app.state.sections.length === 0) {
      paper.innerHTML = `
        <div class="chart-empty-placeholder">
          <div class="chart-empty-placeholder-icon">🎵</div>
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
    const lines = paper.querySelectorAll(LINE_SELECTOR);

    lines.forEach(el => {
      const origWhiteSpace = el.style.whiteSpace;
      const origFontSize = parseFloat(getComputedStyle(el).fontSize);
      if (!origFontSize) return;

      el.style.whiteSpace = 'nowrap';
      const scale = availableWidth / el.scrollWidth;

      if (scale < 1) {
        const clamped = Math.max(scale, 0.6);
        el.style.fontSize = `${origFontSize * clamped}px`;
      }

      if (origWhiteSpace) {
        el.style.whiteSpace = origWhiteSpace;
      } else {
        el.style.whiteSpace = '';
      }
    });
  };

  app.applyZoom = function() {
    const chartPaper = document.getElementById('chart-paper');
    const chartWrapper = document.getElementById('chart-wrapper');
    if (!chartPaper || !chartWrapper) return;
    const scale = app.previewZoom / 100;
    chartPaper.style.zoom = scale;
    chartPaper.style.transform = '';
    chartPaper.style.transformOrigin = '';
    chartWrapper.style.height = '';
    chartWrapper.style.width = '';
  };

})(window.ChartApp = window.ChartApp || {});
