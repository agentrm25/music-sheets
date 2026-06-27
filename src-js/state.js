(function(app) {
  'use strict';

  app.generateId = function() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  app.getNextVerseNumber = function(sections) {
    if (!sections) return 1;
    const verseNums = sections
      .filter(s => s.type === 'verse' && s.verseNumber)
      .map(s => s.verseNumber);
    return verseNums.length > 0 ? Math.max(...verseNums) + 1 : 1;
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
      id: obj.id || app.generateId(),
      title: obj.title || '',
      artist: obj.artist || '',
      bpm: obj.bpm !== undefined ? obj.bpm : null,
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
          id: section.id || app.generateId(),
          type: section.type || 'verse',
          verseNumber: section.verseNumber || null,
          collapsed: !!section.collapsed,
          repeat: section.repeat || null,
          customLabel: section.customLabel || '',
          lines: []
        };
        if (Array.isArray(section.lines)) {
          cleanSection.lines = section.lines.map(line => {
            if (!line || typeof line !== 'object') return null;
            const cleanLine = {
              id: line.id || app.generateId(),
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
