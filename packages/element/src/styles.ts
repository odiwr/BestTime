/**
 * Everything the element looks like.
 *
 * Plain CSS in a shadow root, not a utility framework. An embed script cannot
 * ask the page it lands on to install Tailwind and configure container queries,
 * and a page with its own `.button` rule must not be able to reach in here and
 * break the axis. The shadow boundary settles both directions at once.
 *
 * Theming is done entirely through custom properties, which *do* cross the
 * boundary. That is the seam: everything below is written against a variable,
 * so a theme is a short list of values and never a fork of this file.
 */
export const STYLES = /* css */ `
:host {
  /* The palette. Overriding any of these from the page is the supported way
     to restyle a timeline — see themes/ for complete sets. */
  --bt-accent: #588dbc;
  --bt-accent-ink: #ffffff;
  --bt-surface: #ffffff;
  --bt-ink: #101114;
  --bt-muted: rgba(16, 17, 20, 0.62);
  --bt-faint: rgba(16, 17, 20, 0.4);
  --bt-line: rgba(16, 17, 20, 0.14);
  --bt-line-strong: rgba(16, 17, 20, 0.32);
  --bt-hover: rgba(16, 17, 20, 0.06);
  --bt-radius: 12px;
  --bt-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --bt-height: 620px;
  --bt-axis-height: 300px;

  display: block;
  container-type: inline-size;
  font-family: var(--bt-font);
  color: var(--bt-ink);
  /* Nothing inside sets a font-size in rem, so a host page with a shrunken
     root font does not silently halve the axis labels. */
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

:host([hidden]) { display: none; }

/* The default palette flips with the reader's own setting. An explicit
   theme="light" on the element wins over it, which is why this is not simply a
   media query on its own. */
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) {
    --bt-accent: #7aa9d4;
    --bt-accent-ink: #0b0d10;
    --bt-surface: #0f1115;
    --bt-ink: #f2f4f8;
    --bt-muted: rgba(242, 244, 248, 0.66);
    --bt-faint: rgba(242, 244, 248, 0.42);
    --bt-line: rgba(242, 244, 248, 0.16);
    --bt-line-strong: rgba(242, 244, 248, 0.34);
    --bt-hover: rgba(242, 244, 248, 0.08);
  }
}

:host([theme="dark"]) {
  --bt-accent: #7aa9d4;
  --bt-accent-ink: #0b0d10;
  --bt-surface: #0f1115;
  --bt-ink: #f2f4f8;
  --bt-muted: rgba(242, 244, 248, 0.66);
  --bt-faint: rgba(242, 244, 248, 0.42);
  --bt-line: rgba(242, 244, 248, 0.16);
  --bt-line-strong: rgba(242, 244, 248, 0.34);
  --bt-hover: rgba(242, 244, 248, 0.08);
}

* { box-sizing: border-box; }

/*
 * Rows are placed explicitly rather than reordered with "order".
 *
 * The phone layout puts the controls above the detail, and "order: -1" is the
 * obvious way to say so — but in a grid with named rows, order decides which
 * row an item lands in, so the controls took the 1fr row and the detail got
 * "auto". The articles inside it are absolutely positioned, for the cross-fade,
 * so they contribute no height and the whole pane collapsed to nothing.
 * Naming the row each item belongs to says what is meant and cannot do that.
 */
.bt {
  display: grid;
  grid-template-rows: auto 1fr;
  width: 100%;
}

.bt-controls { grid-row: 1; }
.bt-detail { grid-row: 2; min-height: 540px; }
.bt-axis { grid-row: 3; }

@container (min-width: 640px) {
  .bt {
    grid-template-rows: 1fr auto var(--bt-axis-height);
    height: var(--bt-height);
  }
  .bt-detail { grid-row: 1; min-height: 0; }
  .bt-controls { grid-row: 2; }
  .bt-axis { grid-row: 3; }
}

/* ------------------------------------------------------------------ */
/* States                                                             */
/* ------------------------------------------------------------------ */

.bt-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  padding: 0 24px;
  text-align: center;
  color: var(--bt-faint);
  font-size: 14px;
}

.bt-message p { max-width: 34em; margin: 0; }

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

.bt-detail {
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.bt-article {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  height: 100%;
}

.bt-article[data-media="true"] { grid-template-columns: 1fr; }

@container (min-width: 820px) {
  .bt-article { gap: 44px; }
  .bt-article[data-media="true"] {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
  .bt-words { max-width: 68ch; }
  .bt-article[data-media="true"] .bt-words { max-width: none; }
}

.bt-media {
  position: relative;
  /* Wider than it is tall on a phone, where the picture and the words are
     stacked and the pane has a height to stay inside. */
  aspect-ratio: 16 / 9;
  min-height: 0;
  border-radius: var(--bt-radius);
  overflow: hidden;
  background: var(--bt-hover);
}

/* Through the middle sizes the pane is a fixed height with an axis under it,
   and a picture stacked on top of the words does not fit. */
@container (min-width: 640px) {
  .bt-media { display: none; }
}
@container (min-width: 820px) {
  .bt-media { display: block; aspect-ratio: auto; height: 100%; }
}

.bt-media iframe,
.bt-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.bt-media img { object-fit: cover; }

.bt-words {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 280px;
}

@container (min-width: 640px) {
  .bt-words { height: auto; }
}

.bt-date {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bt-accent);
}

.bt-headline {
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

@container (min-width: 768px) {
  .bt-headline { font-size: 30px; }
}

.bt-text {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--bt-muted);
}

@container (min-width: 768px) {
  .bt-text { font-size: 16px; }
}

.bt-source {
  align-self: flex-start;
  margin-top: 16px;
  font-size: 14px;
  color: var(--bt-accent);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--bt-accent) 40%, transparent);
  text-underline-offset: 4px;
  transition: text-decoration-color 150ms;
}

.bt-source:hover { text-decoration-color: var(--bt-accent); }

/* ------------------------------------------------------------------ */
/* Controls                                                           */
/* ------------------------------------------------------------------ */

/* Above the detail on a phone, below it everywhere else. With no axis to sit
   over, the arrows would otherwise be pushed up and down the screen by however
   tall the description happened to be; at the top they are in the same place
   for every event. Which row that is, is settled in the grid above. */
.bt-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 16px;
}

@container (min-width: 640px) {
  .bt-controls { margin: 24px 0 8px; }
}

.bt-zoom { display: none; align-items: center; gap: 4px; }
@container (min-width: 640px) { .bt-zoom { display: flex; } }

.bt-step { display: flex; align-items: center; gap: 4px; margin-left: auto; }

.bt-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--bt-line);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 150ms, opacity 150ms;
}

.bt-button:hover:not(:disabled) { background: var(--bt-hover); }

.bt-button:disabled { opacity: 0.3; pointer-events: none; }

.bt-button:focus-visible {
  outline: 2px solid var(--bt-accent);
  outline-offset: 2px;
}

/* The two that move the reader through the history rather than around it.
   Zooming is an adjustment; stepping is what most people came to do. */
.bt-button[data-solid] {
  border-color: transparent;
  background: var(--bt-ink);
  color: var(--bt-surface);
}

.bt-button[data-solid]:hover:not(:disabled) { opacity: 0.8; background: var(--bt-ink); }

.bt-button svg { width: 15px; height: 15px; display: block; }

/* ------------------------------------------------------------------ */
/* Axis                                                               */
/* ------------------------------------------------------------------ */

.bt-axis {
  position: relative;
  display: none;
  width: 100%;
  overflow: hidden;
  user-select: none;
  /* So a drag pans the axis rather than scrolling the page. */
  touch-action: none;
  overscroll-behavior: none;
  border: 1px solid var(--bt-line);
  border-radius: var(--bt-radius);
  background: var(--bt-surface);
  outline: none;
  cursor: grab;
}

/* A draggable, zoomable ruler is not a thing anyone can use at 375px, and
   faking one costs more than it gives. The arrows walk the history in order,
   which is how it reads anyway. */
@container (min-width: 640px) { .bt-axis { display: block; } }

.bt-axis[data-panning] { cursor: grabbing; }
.bt-axis:focus-visible { border-color: var(--bt-accent); }

.bt-ticks { position: absolute; left: 0; right: 0; bottom: 0; height: 52px; }

.bt-tick { position: absolute; top: 0; will-change: transform; }

.bt-tick-mark { width: 1px; background: var(--bt-line-strong); height: 16px; }
.bt-tick[data-minor] .bt-tick-mark { height: 8px; background: var(--bt-line); }

.bt-tick-label {
  position: absolute;
  top: 20px;
  left: 0;
  transform: translateX(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--bt-faint);
}

.bt-baseline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 52px;
  height: 1px;
  background: var(--bt-line-strong);
}

.bt-break {
  position: absolute;
  bottom: 45px;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 14px;
  padding: 0 6px;
  transform: translateX(-50%);
  background: var(--bt-surface);
}

.bt-break span {
  width: 1px;
  height: 12px;
  background: var(--bt-line-strong);
  transform: skewX(-12deg);
}

.bt-markers { position: absolute; left: 0; right: 0; bottom: 52px; }

.bt-marker {
  position: absolute;
  bottom: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  z-index: var(--bt-z, 10);
  will-change: transform;
}

.bt-marker:hover { z-index: 50; }
.bt-marker:focus-visible { outline: none; }

/* The stem, from the baseline up to whichever row took the label. */
.bt-stem {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--bt-line);
  transition: background-color 150ms;
}

.bt-marker:hover .bt-stem { background: var(--bt-line-strong); }
.bt-marker[data-selected] .bt-stem { background: var(--bt-accent); }

.bt-label {
  position: absolute;
  left: 0;
  overflow: hidden;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  background: var(--bt-surface);
  color: var(--bt-muted);
  max-width: var(--bt-w);
  transition: max-width 200ms ease-out, background-color 200ms, color 200ms;
}

.bt-label[data-centred] { transform: translateX(-50%); }

/* Both widths are variables rather than an inline max-width: an inline style
   outranks every class, so the collapsed width would win over the hover rule
   and nothing would move. */
.bt-marker:hover .bt-label { max-width: var(--bt-hover-max); }

.bt-marker:hover .bt-label,
.bt-marker:focus-visible .bt-label {
  background: var(--bt-hover);
  color: var(--bt-ink);
}

.bt-marker[data-selected] .bt-label,
.bt-marker[data-selected]:hover .bt-label {
  background: var(--bt-accent);
  color: var(--bt-accent-ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.bt-marker:focus-visible .bt-label {
  outline: 2px solid var(--bt-accent);
  outline-offset: 2px;
}

/* A period reaches across what it covers, drawn just beneath its label.
   Hollow when the span was read from prose, so an inferred range never looks
   as certain as a recorded one. */
.bt-bar {
  position: absolute;
  left: 0;
  height: 6px;
  border-radius: 999px;
  background: var(--bt-line-strong);
  transition: background-color 150ms;
}

.bt-bar[data-approximate] {
  background: var(--bt-line);
  box-shadow: inset 0 0 0 1px var(--bt-line-strong);
}

.bt-marker[data-selected] .bt-bar {
  background: var(--bt-accent);
  box-shadow: none;
}

/* The dot. Always on the line, whatever row the label took. */
.bt-dot {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bt-line-strong);
  transform: translate(-50%, 50%) scale(0.66);
  /* Overshoot, standing in for the spring this used to be. */
  transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 150ms;
}

.bt-marker:hover .bt-dot { background: var(--bt-ink); }
.bt-marker[data-selected] .bt-dot {
  background: var(--bt-accent);
  transform: translate(-50%, 50%) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .bt-dot, .bt-label, .bt-stem, .bt-bar { transition-duration: 1ms; }
}

/* Screen-reader-only, for the list that makes this thing readable without
   a pointer. */
.bt-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;
