/**
 * Shared Header Component — The Last Generation
 * Loads once, injects the header into every page.
 * Per-page customization via data attributes on the mount point.
 *
 * Usage in HTML:
 *   <div id="site-header-mount"
 *        data-page-title="Data Hub"
 *        data-badge="LIVE"
 *        data-landing="false">
 *   </div>
 *   <script src="/src/nav-component.js" defer></script>
 */
(function () {
  'use strict';

  var mount = document.getElementById('site-headerMount');
  if (!mount) return;

  var isLanding = mount.dataset.landing === 'true';
  var pageTitle = mount.dataset.pageTitle || '';
  var badge = mount.dataset.badge || '';

  // ── Header HTML ──
  var headerHTML = '<header id="site-header"' + (isLanding ? ' class="landing"' : '') + '>'
    + '<div class="header-inner">'

    // Brand + page title + badge
    + (isLanding
      ? '<a href="/" class="header-brand">The Last Generation</a>'
      : '<div class="header-left">'
        + '<a href="/" class="header-brand">&larr; The Last Generation</a>'
        + (pageTitle ? '<span class="header-page-title">' + pageTitle + '</span>' : '')
        + (badge ? '<span class="header-badge">' + badge + '</span>' : '')
        + '</div>'
    )

    // Overlay
    + '<div class="nav-overlay" id="navOverlay"></div>'

    // ── Nav with dropdown categories ──
    + '<nav class="header-nav" id="headerNav">'

    // Live Now
    + '<div class="nav-dropdown" data-dropdown>'
    + '<button class="nav-cat-trigger" aria-expanded="false">Live Now <svg class="nav-cat-chevron" viewBox="0 0 10 10"><polyline points="2,3.5 5,6.5 8,3.5"/></svg></button>'
    + '<div class="nav-cat-panel">'
    + '<a href="/dashboard.html" class="nav-cat-item">Dashboard</a>'
    + '<a href="/disasters.html" class="nav-cat-item">World Watch</a>'
    + '<a href="/conflicts.html" class="nav-cat-item">Conflicts Watch</a>'
    + '<a href="/apophis.html" class="nav-cat-item">Apophis Tracker</a>'
    + '</div></div>'

    + '<span class="nav-sep"></span>'

    // Interactive
    + '<div class="nav-dropdown" data-dropdown>'
    + '<button class="nav-cat-trigger" aria-expanded="false">Interactive <svg class="nav-cat-chevron" viewBox="0 0 10 10"><polyline points="2,3.5 5,6.5 8,3.5"/></svg></button>'
    + '<div class="nav-cat-panel">'
    + '<a href="/sign-of-jonah.html" class="nav-cat-item">Sign of Jonah</a>'
    + '<a href="/rev12-calculator.html" class="nav-cat-item">Rev 12 Calculator</a>'
    + '</div></div>'

    + '<span class="nav-sep"></span>'

    // Prophecy
    + '<div class="nav-dropdown" data-dropdown>'
    + '<button class="nav-cat-trigger" aria-expanded="false">Prophecy <svg class="nav-cat-chevron" viewBox="0 0 10 10"><polyline points="2,3.5 5,6.5 8,3.5"/></svg></button>'
    + '<div class="nav-cat-panel">'
    + '<a href="/timeline.html" class="nav-cat-item">Prophetic Timeline</a>'
    + '<a href="/convergence.html" class="nav-cat-item">Convergence</a>'
    + '<a href="/calendar.html" class="nav-cat-item">Prophecy Calendar</a>'
    + '<a href="/rapture.html" class="nav-cat-item">Rapture &amp; Tribulation</a>'
    + '<a href="/revelation-walkthrough.html" class="nav-cat-item">Revelation Walkthrough</a>'
    + '</div></div>'

    + '<span class="nav-sep"></span>'

    // Foundations
    + '<div class="nav-dropdown" data-dropdown>'
    + '<button class="nav-cat-trigger" aria-expanded="false">Foundations <svg class="nav-cat-chevron" viewBox="0 0 10 10"><polyline points="2,3.5 5,6.5 8,3.5"/></svg></button>'
    + '<div class="nav-cat-panel">'
    + '<a href="/aleph-tav.html" class="nav-cat-item">Aleph-Tav</a>'
    + '<a href="/hebrew-feasts.html" class="nav-cat-item">7 Feasts</a>'
    + '<a href="/betrothal.html" class="nav-cat-item">The Betrothal</a>'
    + '</div></div>'

    + '<span class="nav-sep"></span>'

    // Reference
    + '<div class="nav-dropdown" data-dropdown>'
    + '<button class="nav-cat-trigger" aria-expanded="false">Reference <svg class="nav-cat-chevron" viewBox="0 0 10 10"><polyline points="2,3.5 5,6.5 8,3.5"/></svg></button>'
    + '<div class="nav-cat-panel">'
    + '<a href="/digest.html" class="nav-cat-item">Digest</a>'
    + '<a href="/glossary.html" class="nav-cat-item">Glossary</a>'
    + '<a href="/library.html" class="nav-cat-item">Library</a>'
    + '</div></div>'

    + '</nav>'

    // ── Header End ──
    + '<div class="header-end">'

    // Language switcher (landing page only)
    + (isLanding
      ? '<div class="lang-switcher">'
        + '<button class="lang-globe" id="langGlobe" aria-label="Select language">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="globe-icon">'
        + '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>'
        + '</svg></button>'
        + '<div class="lang-dropdown" id="langDropdown">'
        + '<button class="lang-option" data-lang="en">English</button>'
        + '<button class="lang-option" data-lang="es">Español</button>'
        + '<button class="lang-option" data-lang="pt">Português</button>'
        + '<button class="lang-option" data-lang="fr">Français</button>'
        + '<button class="lang-option" data-lang="de">Deutsch</button>'
        + '<button class="lang-option" data-lang="it">Italiano</button>'
        + '<button class="lang-option" data-lang="ru">Русский</button>'
        + '<button class="lang-option" data-lang="zh-CN">简体中文</button>'
        + '<button class="lang-option" data-lang="zh-HK">繁體中文</button>'
        + '<button class="lang-option" data-lang="ja">日本語</button>'
        + '<button class="lang-option" data-lang="ko">한국어</button>'
        + '<button class="lang-option" data-lang="ar">العربية</button>'
        + '</div></div>'
      : ''
    )

    // Theme toggle (landing page only)
    + (isLanding
      ? '<button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">'
        + '<svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
        + '</svg>'
        + '<svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        + '</svg></button>'
      : ''
    )

    // Hamburger
    + '<button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">'
    + '<span class="menu-bar"></span><span class="menu-bar"></span><span class="menu-bar"></span>'
    + '</button>'

    + '</div>'
    + '</div>'
    + '</header>';

  // ── Inject header ──
  mount.insertAdjacentHTML('afterbegin', headerHTML);

  // ── Event Listeners ──
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('headerNav');
  var overlay = document.getElementById('navOverlay');

  function closeMenu() {
    if (toggle) toggle.classList.remove('open');
    if (nav) nav.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    document.querySelectorAll('.nav-dropdown.open').forEach(function (d) {
      d.classList.remove('open');
      var t = d.querySelector('.nav-cat-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  // Hamburger
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      if (nav.classList.contains('open')) closeMenu();
      else {
        nav.classList.add('open');
        overlay.classList.add('visible');
        toggle.classList.add('open');
      }
    });
    if (overlay) overlay.addEventListener('click', closeMenu);
    nav.querySelectorAll('.nav-cat-item').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }

  // Desktop: hover to open dropdowns
  document.querySelectorAll('.nav-dropdown').forEach(function (dd) {
    var trigger = dd.querySelector('.nav-cat-trigger');
    var hoverTimeout;

    dd.addEventListener('mouseenter', function () {
      clearTimeout(hoverTimeout);
      // Close other open dropdowns first
      document.querySelectorAll('.nav-dropdown.open').forEach(function (other) {
        if (other !== dd) {
          other.classList.remove('open');
          var ot = other.querySelector('.nav-cat-trigger');
          if (ot) ot.setAttribute('aria-expanded', 'false');
        }
      });
      dd.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    dd.addEventListener('mouseleave', function () {
      hoverTimeout = setTimeout(function () {
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }, 120);
    });

    // Mobile / touch: click to toggle accordion
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      var isOpen = dd.classList.contains('open');
      // Close others
      document.querySelectorAll('.nav-dropdown.open').forEach(function (other) {
        if (other !== dd) {
          other.classList.remove('open');
          var ot = other.querySelector('.nav-cat-trigger');
          if (ot) ot.setAttribute('aria-expanded', 'false');
        }
      });
      dd.classList.toggle('open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  // ── Highlight active page ──
  var currentPath = window.location.pathname;
  document.querySelectorAll('.nav-cat-item').forEach(function (item) {
    if (item.getAttribute('href') === currentPath) {
      item.classList.add('active');
      var parentDD = item.closest('.nav-dropdown');
      if (parentDD) {
        parentDD.classList.add('open');
        var t = parentDD.querySelector('.nav-cat-trigger');
        if (t) t.setAttribute('aria-expanded', 'true');
      }
    }
  });

  // ── Language Switcher (landing only) ──
  var globe = document.getElementById('langGlobe');
  var langDropdown = document.getElementById('langDropdown');
  if (globe && langDropdown) {
    globe.addEventListener('click', function (e) {
      e.stopPropagation();
      langDropdown.classList.toggle('open');
    });
    document.addEventListener('click', function () { langDropdown.classList.remove('open'); });
    langDropdown.addEventListener('click', function (e) { e.stopPropagation(); });
    langDropdown.querySelectorAll('.lang-option').forEach(function (btn) {
      btn.addEventListener('click', function () { langDropdown.classList.remove('open'); });
    });
  }

  // ── Theme Toggle (landing only) ──
  var themeToggle = document.getElementById('themeToggle');
  var savedTheme = localStorage.getItem('tlg-theme');
  if (savedTheme === 'light') document.documentElement.classList.add('light-mode');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isLight = document.documentElement.classList.toggle('light-mode');
      localStorage.setItem('tlg-theme', isLight ? 'light' : 'dark');
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: isLight ? 'light' : 'dark' } }));
    });
  }
})();
