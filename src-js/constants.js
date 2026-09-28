(function(app) {
  'use strict';

  app.VERSE_COLORS = ['#cc1800', '#ff7a00', '#8a2be2', '#0070c0', '#00b050', '#6b6b6b'];

  app.SECTION_META = {
    intro:        { label: 'INTRO',        color: '#cc00cc' },
    verse:        { label: '',             color: '#cc1800' }, 
    chorus:       { label: 'CHORUS',       color: '#217a14' },
    bridge:       { label: 'BRIDGE',       color: '#6a1f9a' },
    outro:        { label: 'OUTRO',        color: '#6b6b6b' },
    instrumental: { label: 'INSTRUMENTAL', color: '#1a55d4' },
    custom:       { label: 'SECTION',      color: '#9b5c00' }
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Decorative icon from the sprite in index.html. Always aria-hidden: the
  // owning control carries the accessible name.
  app.icon = function(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `icon icon-${name}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#icon-${name}`);
    svg.appendChild(use);
    return svg;
  };

  app.prefersReducedMotion = function() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  app.scrollBehavior = function() {
    return app.prefersReducedMotion() ? 'auto' : 'smooth';
  };

  app.SEARCH_DEBOUNCE_MS = 120;

  // Run `callback` once input has paused for `delay` ms.
  app.debounce = function(callback, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => callback.apply(this, args), delay);
    };
  };

})(window.ChartApp = window.ChartApp || {});
