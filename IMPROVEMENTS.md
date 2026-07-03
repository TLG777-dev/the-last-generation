# Improvement Proposals — The Last Generation

Catalog of SOTA web techniques to evaluate and implement incrementally.
See `SESSION_STATE.md` for implementation status of items marked DONE.

---

## P0 — High Impact, Low Effort

### 1. Speculation Rules API
**Status:** DONE on index.html — implement per page as each is touched
**Effort:** ~5 min per page
**Impact:** Instant page loads after hover

One `<script type="speculationrules">` tag in `<head>`. Chromium browsers prerender
likely-next pages on hover. For an MPA with heavy JS (Three.js, MapLibre), this is
the single biggest perceived-speed improvement — visitors see 0ms white flash.

```html
<script type="speculationrules">
{"prerender": [{"where": {"href_matches": "/*"}}]}
</script>
```

Falls back gracefully in Safari/Firefox.

---

### 2. Fluid Typography with `clamp()`
**Status:** DONE on index.html
**Effort:** ~30 min per page
**Impact:** Smooth type scaling at every viewport width

Replace stepped breakpoint font sizes with `clamp()` that scales continuously
between 360px and 1400px. No visible snap points — text glides at every width.

```css
/* Before (stepped) */
--fs-display: 1.8rem;
@media (max-width: 900px) { --fs-display: 1.5rem; }
@media (max-width: 480px) { --fs-display: 1.2rem; }

/* After (fluid) */
--fs-display: clamp(1.2rem, 0.923vw + 0.992rem, 1.8rem);
```

All nine `--fs-*` variables become fluid. Spacing (padding, gaps, margins) can
also benefit from the same technique.

---

## P1 — Production-Ready Modernization

### 3. Container Queries
**Status:** DONE on index.html (explore grid)
**Effort:** ~2-3 hours site-wide
**Impact:** Components adapt to their own container, not the viewport

Replace viewport media queries on reusable components (cards, grids, widgets)
with `@container` queries. Components respond to their own available space.
A teacher card in a sidebar vs. a main column renders optimally in each context.

Best candidates:
- Dashboard data cards
- Teacher/source cards (rapture, feasts)
- Explore grid cards
- Calendar grid tiles
- Any card used in multiple layout contexts

```css
.container-parent { container-type: inline-size; }
@container (min-width: 400px) {
  .child { grid-template-columns: 200px 1fr; }
}
```

93%+ browser support. Falls back to default mobile styles in legacy browsers.

---

### 4. View Transitions API
**Status:** DONE on index.html
**Effort:** ~1 hour site-wide
**Impact:** Smooth crossfade between pages instead of hard cut

```css
@view-transition { navigation: auto; }
```

Three lines of CSS. Same-origin navigations get a smooth crossfade. Optionally
name shared elements (site logo, header) with `view-transition-name` for morph
animations between pages.

89% browser support. Falls back to normal navigation in unsupported browsers.
Combined with Speculation Rules, the 70ms LCP cost is eliminated (page is
already prerendered when transition fires).

---

## P2 — Polish & Performance

### 5. Scroll-Driven Animations
**Status:** Not yet implemented
**Effort:** ~2 hours
**Impact:** Jank-free scroll animations on compositor thread

Replace IntersectionObserver-based card reveals with pure CSS
`animation-timeline: view()`. Same visual effect, but runs on compositor
thread — no JS, no main-thread jank, smoother on mobile.

Also enables new effects without JS:
- Reading progress bar (any long page)
- Parallax hero on scroll
- Scroll-triggered reveal fades

```css
.card {
  animation: fade-in-up linear both;
  animation-timeline: view();
  animation-range: entry 10% cover 40%;
}
```

Best for: rapture.html card reveals, convergence timeline entrance, long
form content (hebrew-feasts.html).

---

### 6. Intrinsic Grid Layouts
**Status:** Not yet implemented
**Effort:** ~1 hour
**Impact:** Self-adjusting grids, no breakpoints to maintain

Replace hardcoded `grid-template-columns: repeat(N, 1fr)` with
`auto-fit`/`auto-fill` + `minmax()`. Grid automatically adjusts column
count at every width.

```css
/* Before */
.hf-teacher-grid { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 768px) { .hf-teacher-grid { grid-template-columns: 1fr; } }

/* After — one declaration, zero breakpoints */
.hf-teacher-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
```

Best for: teacher grids, dashboard cards, explore cards, calendar tiles.

---

## P3 — Nice-to-Have

### 7. `:has()` Selector Refinements
**Status:** Not yet implemented
**Effort:** ~30 min
**Impact:** Remove JS class toggles for conditional parent styling

```css
/* Style card differently if it contains a critical value */
.data-card:has(.critical) { border-color: red; }

/* Highlight form field with invalid input */
.field:has(:invalid) { border-color: red; }
```

95% browser support.

---

### 8. OKLCH Color Space
**Status:** Not yet implemented
**Effort:** ~1 hour
**Impact:** Perceptually uniform color manipulation, easier dark/light themes

Replace hex values with OKLCH for hover states, gradients, and theme
variations. Perceptually uniform — `l+10%` looks equally lighter to the eye
at any hue.

```css
:root {
  --gold: oklch(75% 0.15 85);
}
.hover-state {
  color: oklch(from var(--gold) calc(l + 10%) c h);
}
```

---

## P4 — Experimental / Forward-Looking

### 9. CSS Nesting
**Status:** Not yet implemented
**Effort:** ~30 min to audit
**Impact:** Cleaner, more maintainable CSS

```css
/* Before */
.parent h4 { ... }
.parent p { ... }
.parent .child { ... }

/* After */
.parent {
  & h4 { ... }
  & p { ... }
  & .child { ... }
}
```

Safari 16.5+, Chrome 120+, Firefox 117+. Don't use with older Tailwind
versions — may conflict with preprocessor nesting.

---

### 10. Anchor Positioning API
**Status:** Not yet implemented
**Effort:** ~2 hours
**Impact:** CSS-native tooltip/popover positioning, no JS

Replace JS-positioned tooltips (rapture timeline) with CSS anchor
positioning. Browser support still incomplete — requires progressive
enhancement.

```css
.tooltip {
  position-anchor: --trigger;
  position-area: top center;
}
```

Partial browser support. Skip until Safari ships.

---

## Implementation Order (Recommended)

| Step | Feature | Time | Pages |
|------|---------|------|-------|
| 1 | Speculation Rules | few min/page | ALL |
| 2 | Fluid Typography | ~30 min/page | ALL |
| 3 | Container Queries | ~2-3 hr | dashboard, rapture, feasts, convergence |
| 4 | View Transitions | ~1 hr | ALL |
| 5 | Scroll-Driven Animations | ~2 hr | rapture, feasts, convergence |
| 6 | Intrinsic Grids | ~1 hr | ALL grid layouts |
| 7 | :has() + OKLCH | ~1.5 hr | Various |
| 8 | Nesting | ~30 min | ALL CSS files |
