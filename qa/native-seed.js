(function seedNativeQaOrigin() {
  'use strict';

  const FIXTURE_VERSION = 'approval-b-v1';
  const MARKER_KEY = 'chart-creator-qa-native-fixture-version';
  if (localStorage.getItem(MARKER_KEY) === FIXTURE_VERSION) return;

  const timestamp = '2026-07-15T00:00:00.000Z';
  const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'Am'];
  const sectionTypes = ['intro', 'verse', 'chorus', 'bridge', 'outro'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeLine(chartIndex, sectionIndex, lineIndex) {
    const chord = lineIndex % 3 === 0;
    return {
      id: `qa-line-${chartIndex}-${sectionIndex}-${lineIndex}`,
      type: chord ? 'chord' : 'lyric',
      content: chord ? 'C G Am F' : `Synthetic lyric ${chartIndex + 1}.${sectionIndex + 1}.${lineIndex + 1}`,
      chords: '',
      bold: lineIndex % 8 === 7
    };
  }

  function makeSection(chartIndex, sectionIndex, lineCount) {
    const type = sectionTypes[sectionIndex % sectionTypes.length];
    const section = {
      id: `qa-section-${chartIndex}-${sectionIndex}`,
      type,
      customLabel: '',
      repeat: type === 'chorus' ? 2 : null,
      collapsed: false,
      editorHeight: null,
      lines: Array.from({ length: lineCount }, (_, lineIndex) =>
        makeLine(chartIndex, sectionIndex, lineIndex)
      )
    };
    if (type === 'verse') section.verseNumber = (sectionIndex % 99) + 1;
    return section;
  }

  function makeChart(chartIndex, sectionCount, lineCount) {
    const number = String(chartIndex + 1).padStart(3, '0');
    return {
      id: `qa-chart-${chartIndex}`,
      title: `QA Chart ${number}`,
      artist: `Synthetic Artist ${(chartIndex % 25) + 1}`,
      key: keys[chartIndex % keys.length],
      originalKey: keys[(chartIndex + 2) % keys.length],
      bpm: 80 + (chartIndex % 81),
      timeSignature: chartIndex % 3 === 0 ? '6/8' : '4/4',
      capo: chartIndex % 10 === 0 ? '2' : '',
      arrangementNotes: `Synthetic rehearsal note ${chartIndex + 1}`,
      groupId: chartIndex % 4 === 0 ? '' : `qa-group-${chartIndex % 30}`,
      status: ['draft', 'ready', 'archived'][chartIndex % 3],
      source: 'Synthetic QA fixture',
      privateNotes: 'Synthetic private QA note',
      sections: Array.from({ length: sectionCount }, (_, sectionIndex) =>
        makeSection(chartIndex, sectionIndex, lineCount)
      )
    };
  }

  const groups = Array.from({ length: 30 }, (_, index) => ({
    id: `qa-group-${index}`,
    name: `QA Group ${String(index + 1).padStart(2, '0')}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  const charts = Array.from({ length: 300 }, (_, chartIndex) => {
    const data = makeChart(chartIndex, 3, 4);
    const versions = chartIndex % 10 === 0
      ? Array.from({ length: 3 }, (_, versionIndex) => {
          const versionData = clone(data);
          versionData.title = `${data.title} v${versionIndex + 1}`;
          return {
            id: `qa-version-${chartIndex}-${versionIndex}`,
            name: `QA Version ${versionIndex + 1}`,
            notes: 'Synthetic version snapshot',
            createdAt: timestamp,
            key: versionData.key,
            sectionsCount: versionData.sections.length,
            data: versionData
          };
        })
      : [];
    return {
      name: data.title,
      data,
      savedAt: timestamp,
      key: data.key,
      sectionsCount: data.sections.length,
      isFavorite: chartIndex % 17 === 0,
      groupId: data.groupId,
      versions
    };
  });

  const collected = Array.from({ length: 120 }, (_, index) => {
    const section = makeSection(20000 + index, 0, 4);
    section.id = `qa-collected-section-${index}`;
    section.lines.forEach((line, lineIndex) => {
      line.id = `qa-collected-line-${index}-${lineIndex}`;
    });
    return {
      id: `qa-collected-${index}`,
      name: `QA Collected ${String(index + 1).padStart(3, '0')}`,
      type: section.type,
      sourceChartId: `qa-chart-${index % 300}`,
      sourceChartTitle: `QA Chart ${String((index % 300) + 1).padStart(3, '0')}`,
      savedAt: timestamp,
      section
    };
  });

  const dense = makeChart(10000, 50, 8);
  dense.title = 'QA Dense 50 Sections 400 Lines';
  dense.artist = 'Synthetic Scale Artist';

  localStorage.setItem('chart-creator-state', JSON.stringify(dense));
  localStorage.setItem('chart-creator-saved', JSON.stringify(charts));
  localStorage.setItem('chart-creator-groups', JSON.stringify(groups));
  localStorage.setItem('chart-creator-collected-sections', JSON.stringify(collected));
  localStorage.setItem('chart-creator-settings', JSON.stringify({ saveDirectory: '', theme: 'dark' }));
  localStorage.setItem(MARKER_KEY, FIXTURE_VERSION);
})();
