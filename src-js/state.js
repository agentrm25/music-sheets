(function(app) {
  'use strict';

  app.generateId = function() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  app.normalizeId = function(value, fallback) {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (candidate && new TextEncoder().encode(candidate).length <= 100) return candidate;
    const replacement = typeof fallback === 'function' ? fallback() : fallback;
    return typeof replacement === 'string' && replacement.trim()
      ? replacement.trim()
      : app.generateId();
  };

  app.normalizeIntegerInRange = function(value, min, max) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    return Math.min(max, Math.max(min, Math.trunc(number)));
  };

  app.normalizeBpm = function(value) {
    return app.normalizeIntegerInRange(value, 20, 300);
  };

  app.normalizeVerseNumber = function(value) {
    return app.normalizeIntegerInRange(value, 1, 99);
  };

  app.normalizeRepeat = function(value) {
    return app.normalizeIntegerInRange(value, 1, 99);
  };

  app.getNextVerseNumber = function(sections) {
    if (!sections) return 1;
    const verseNums = sections
      .filter(s => s && s.type === 'verse')
      .map(s => app.normalizeVerseNumber(s.verseNumber))
      .filter(value => value !== null);
    return verseNums.length > 0
      ? app.normalizeVerseNumber(Math.max(...verseNums) + 1)
      : 1;
  };

  app.createEmptyChart = function() {
    return {
      id: app.generateId(),
      title: '',
      artist: '',
      bpm: null,
      timeSignature: '',
      key: '',
      originalKey: '',
      capo: '',
      arrangementNotes: '',
      groupId: '',
      status: '',
      source: '',
      infoNotes: '',
      sections: []
    };
  };

  app.createSection = function(type = 'verse', sections = null) {
    return {
      id: app.generateId(),
      type,
      verseNumber: type === 'verse' ? app.getNextVerseNumber(sections) : null,
      collapsed: false,
      repeat: null,
      customLabel: '',
      editorHeight: '',
      lines: []
    };
  };

  app.createLine = function(type = 'lyric', content = '', bold = false) {
    const line = { id: app.generateId(), type, content, bold };
    if (type === 'grid') {
      line.chords = '';
    }
    return line;
  };

  app.normalizeState = function(obj) {
    if (!obj || typeof obj !== 'object') {
      return app.createEmptyChart();
    }
    const cleanState = {
      id: app.normalizeId(obj.id),
      title: obj.title || '',
      artist: obj.artist || '',
      bpm: app.normalizeBpm(obj.bpm),
      timeSignature: obj.timeSignature || '',
      key: obj.key || '',
      originalKey: obj.originalKey || '',
      capo: obj.capo || '',
      arrangementNotes: obj.arrangementNotes || '',
      groupId: obj.groupId || '',
      status: obj.status || '',
      source: obj.source || '',
      infoNotes: obj.infoNotes || '',
      sections: []
    };

    if (Array.isArray(obj.sections)) {
      cleanState.sections = obj.sections.map(section => {
        if (!section || typeof section !== 'object') return null;
        const cleanSection = {
          id: app.normalizeId(section.id),
          type: section.type || 'verse',
          verseNumber: app.normalizeVerseNumber(section.verseNumber),
          collapsed: !!section.collapsed,
          repeat: app.normalizeRepeat(section.repeat),
          customLabel: section.customLabel || '',
          editorHeight: typeof section.editorHeight === 'string' && /^\d+(?:\.\d+)?px$/.test(section.editorHeight)
            ? section.editorHeight
            : '',
          lines: []
        };
        if (Array.isArray(section.lines)) {
          cleanSection.lines = section.lines.map(line => {
            if (!line || typeof line !== 'object') return null;
            const cleanLine = {
              id: app.normalizeId(line.id),
              type: line.type || 'lyric',
              content: line.content || '',
              bold: !!line.bold
            };
            if (cleanLine.type === 'grid') {
              cleanLine.chords = line.chords || '';
            }
            return cleanLine;
          }).filter(Boolean);
        }
        return cleanSection;
      }).filter(Boolean);
    }
    return cleanState;
  };

  app.SECTION_TEMPLATES = [
    { name: 'Empty (default)', lines: function () { return [app.createLine('chord'), app.createLine('lyric')]; } },
    { name: 'Verse - 4 bar', lines: function () { const arr = []; for (let i = 0; i < 4; i++) { const l = app.createLine('grid'); l.chords = ''; arr.push(l); } return arr; } },
    { name: 'Chorus - 8 bar', lines: function () { const arr = []; for (let i = 0; i < 8; i++) { const l = app.createLine('grid'); l.chords = ''; arr.push(l); } return arr; } },
    { name: 'Bridge - 4 bar', lines: function () { const arr = []; for (let i = 0; i < 4; i++) { const l = app.createLine('grid'); l.chords = ''; arr.push(l); } return arr; } },
    { name: 'Intro / Outro - chords only', lines: function () { return [app.createLine('chord'), app.createLine('chord'), app.createLine('chord'), app.createLine('chord')]; } },
    { name: 'Instrumental - 8 bar chords', lines: function () { const arr = []; for (let i = 0; i < 8; i++) arr.push(app.createLine('chord')); return arr; } }
  ];

})(window.ChartApp = window.ChartApp || {});
