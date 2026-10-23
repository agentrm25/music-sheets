(function(app) {
  'use strict';

  const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // The spellings offered by the Key and Original Key selects, by pitch class.
  const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

  const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

  function noteIndex(note) {
    let idx = NOTES_SHARP.indexOf(note);
    if (idx === -1) idx = NOTES_FLAT.indexOf(note);
    return idx;
  }

  app.transposeNote = function(note, semitones, useFlats) {
    const idx = noteIndex(note);
    if (idx === -1) return note;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return useFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];
  };

  // Split a key such as "F#m" into its pitch class and mode.
  app.parseKey = function(key) {
    const match = typeof key === 'string' ? key.trim().match(/^([A-G][#b]?)(m)?$/) : null;
    if (!match) return null;
    const index = noteIndex(match[1]);
    if (index === -1) return null;
    return { index, minor: !!match[2] };
  };

  // The select spelling for a key, so "G#" shows as "Ab" and "Dbm" as "C#m".
  app.canonicalKey = function(key) {
    const parsed = app.parseKey(key);
    if (!parsed) return key || '';
    return (parsed.minor ? MINOR_KEYS : MAJOR_KEYS)[parsed.index];
  };

  // Move a key, keeping its mode, and spell it the way the Key select does.
  app.transposeKey = function(key, semitones) {
    const parsed = app.parseKey(key);
    if (!parsed) return key || '';
    const index = ((parsed.index + semitones) % 12 + 12) % 12;
    return (parsed.minor ? MINOR_KEYS : MAJOR_KEYS)[index];
  };

  // Signed semitone distance from `fromKey` to `toKey`, in -5..+6, or null.
  app.keyOffset = function(fromKey, toKey) {
    const from = app.parseKey(fromKey);
    const to = app.parseKey(toKey);
    if (!from || !to) return null;
    let offset = ((to.index - from.index) % 12 + 12) % 12;
    if (offset > 6) offset -= 12;
    return offset;
  };

  app.transposeChordLine = function(line, semitones, useFlats) {
    return line.replace(/\b([A-G][#b]?)([^\s,;|]*)/g, (m, root, rest) => {
      return (root + rest).split('/').map(part => {
        const match = part.match(/^([A-G][#b]?)(.*)/);
        if (!match) return part;
        return app.transposeNote(match[1], semitones, useFlats) + match[2];
      }).join('/');
    });
  };

  app.determineUseFlats = function(key) {
    if (!key) return false;
    return FLAT_KEYS.has(key);
  };

})(window.ChartApp = window.ChartApp || {});
