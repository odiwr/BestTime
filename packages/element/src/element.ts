import {
  buildScale,
  fitZoom,
  loaderFor,
  yearToUnit,
  zoomAbout,
  ZOOM_STEP,
  type Loader,
  type Scale,
  type ScaleOptions,
  type TimelineEvent,
} from "@besttime/core";

import { Axis } from "./axis";
import { Detail } from "./detail";
import { ICONS } from "./icons";
import { STYLES } from "./styles";

/**
 * `<best-time>` — the whole thing.
 *
 * Details above, axis below. The axis is the control surface: drag to travel,
 * wheel to zoom about the pointer, click a marker to read it, arrow keys to
 * step through in order.
 *
 * Pan and zoom live in plain fields and are written straight to the DOM in a
 * frame callback. A wheel gesture fires dozens of events a second, and anything
 * that re-lays-out the page on each one stutters. The only things that cause
 * real work are the visible span and which event is selected.
 */

/** Room either side of the data, so the ends are reachable rather than walls. */
const EDGE_PADDING = 0.12;

/** How long the view takes to slide an event to the middle. */
const GLIDE_MS = 420;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

const memoryKey = (source: string) => `besttime:last:${source}`;

export class BestTimeElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [
      "src",
      "height",
      "axis-height",
      "accent",
      "theme",
      "max-year",
      "min-year",
      "collapse-gaps",
      "remember",
      "cache-ms",
    ];
  }

  #shadow: ShadowRoot;
  #frame: HTMLDivElement;
  #detail: Detail;
  #axis: Axis;
  #controls!: HTMLDivElement;
  #buttons: Record<string, HTMLButtonElement> = {};

  #events: TimelineEvent[] = [];
  #ordered: TimelineEvent[] = [];
  #scale: Scale = { segments: [], total: 1, range: 1, maxPxPerUnit: 1400 };
  #selectedId: string | null = null;

  #view = { pxPerUnit: 1, offset: 0 };
  #width = 0;
  #fitted = false;
  #raf: number | null = null;
  #glide: {
    fromPx: number;
    toPx: number;
    fromOffset: number;
    toOffset: number;
    start: number;
  } | null = null;

  #drag = { active: false, x: 0, offset: 0, moved: false };
  #observer: ResizeObserver | null = null;
  #abort: AbortController | null = null;
  #generation = 0;

  /** Set directly to bypass `src` entirely. */
  loader: Loader | null = null;

  /** Per-picture framing, by media URL. */
  set crops(value: Record<string, number>) {
    this.#detail.crops = value;
  }
  get crops(): Record<string, number> {
    return this.#detail.crops;
  }

  /** Extra axis options, for anyone who wants to override the derivation. */
  scaleOptions: ScaleOptions = {};

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLES;

    this.#frame = document.createElement("div");
    this.#frame.className = "bt";

    this.#detail = new Detail(document);
    this.#axis = new Axis(document, (id) => this.focusEvent(id));

    this.#frame.append(this.#detail.el, this.#makeControls(), this.#axis.el);
    this.#shadow.append(style, this.#frame);

    this.#bindAxis();
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  connectedCallback(): void {
    this.#observer = new ResizeObserver(([entry]) => {
      this.#width = entry.contentRect.width;
      this.#maybeFit();
      this.#schedule();
    });
    this.#observer.observe(this.#axis.el);

    document.addEventListener("keydown", this.#onKey);

    // Rows are assigned from measured label widths, and a web font that arrives
    // after the first paint changes every one of them. Without this the layout
    // stays committed to widths measured in the fallback face, which on a page
    // using a display font means labels that overlap or rows that are half
    // empty. Optional chaining because `document.fonts` is absent in some
    // embedded webviews.
    document.fonts?.ready
      .then(() => {
        if (!this.isConnected) return;
        this.#axis.invalidateMetrics();
        this.#schedule();
      })
      .catch(() => {
        // A font that never resolves is not a reason to break the timeline.
      });

    if (!this.#events.length) void this.load();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    document.removeEventListener("keydown", this.#onKey);
    this.#abort?.abort();
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (before === after) return;

    if (name === "accent" && after) {
      this.style.setProperty("--bt-accent", after);
      return;
    }
    if (name === "height" && after) {
      this.style.setProperty("--bt-height", this.#length(after));
      return;
    }
    if (name === "axis-height" && after) {
      this.style.setProperty("--bt-axis-height", this.#length(after));
      return;
    }
    // A changed source is a different timeline. Anything else that reaches
    // here only alters how the existing one is read, and needs a reparse.
    if (this.isConnected && (name === "src" || name === "max-year" || name === "min-year")) {
      void this.load();
    }
    if (name === "collapse-gaps") this.#rebuild();
  }

  /** A bare number in an attribute means pixels. */
  #length(value: string): string {
    return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
  }

  /* ------------------------------------------------------------------ */
  /* Data                                                               */
  /* ------------------------------------------------------------------ */

  /** The events currently drawn. Assigning replaces them without a fetch. */
  get events(): TimelineEvent[] {
    return this.#events;
  }
  set events(value: TimelineEvent[]) {
    this.loader = null;
    this.#adopt(value);
  }

  get selected(): TimelineEvent | null {
    return this.#events.find((event) => event.id === this.#selectedId) ?? null;
  }

  #parseOptions() {
    const number = (name: string) => {
      const raw = this.getAttribute(name);
      if (raw === null) return undefined;
      if (raw === "none" || raw === "infinity") return Infinity;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };

    return {
      maxYear: number("max-year"),
      minYear: number("min-year") === undefined ? undefined : -Math.abs(number("min-year")!),
      cacheMs: number("cache-ms"),
    };
  }

  /** Loads from `loader`, or from `src`. Safe to call again at any time. */
  async load(): Promise<void> {
    const generation = ++this.#generation;

    this.#abort?.abort();
    this.#abort = new AbortController();

    const src = this.getAttribute("src");
    const loader = this.loader ?? (src ? loaderFor(src, {
      ...this.#parseOptions(),
      signal: this.#abort.signal,
    }) : null);

    if (!loader) {
      this.#message(
        "No source. Give this element a src pointing at a published Google Sheet, a CSV, or a JSON file.",
      );
      return;
    }

    this.#message("Loading the timeline…");

    try {
      const events = await loader();
      if (generation !== this.#generation) return;

      if (events.length === 0) {
        this.#message(
          "That source loaded, but no rows in it could be read as events. Each row needs a headline and something that reads as a date.",
        );
        return;
      }

      this.#adopt(events);
      this.dispatchEvent(
        new CustomEvent("besttime:load", {
          detail: { events },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (generation !== this.#generation) return;
      // An abort is this element being asked for something else, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;

      const reason = error instanceof Error ? error.message : String(error);
      this.#message(reason);
      this.dispatchEvent(
        new CustomEvent("besttime:error", {
          detail: { error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  #adopt(events: TimelineEvent[]): void {
    this.#events = events;
    this.#ordered = [...events].sort((a, b) => a.from - b.from);
    this.#fitted = false;
    this.#restoreFrame();
    this.#rebuild();

    // The first event by default, because opening on "pick something" wastes
    // the largest pane on the page and a history reads from its beginning. A
    // reader who has been here before gets back what they were last looking at.
    const remembered = this.#remembered();
    const first = this.#ordered[0];
    this.#select(remembered ?? first?.id ?? null, false);

    this.#maybeFit();
    this.#schedule();
  }

  #rebuild(): void {
    const collapse = this.getAttribute("collapse-gaps");
    this.#scale = buildScale(this.#events, {
      ...this.scaleOptions,
      collapseGaps: collapse === null ? undefined : collapse !== "false",
      maxYear: this.#parseOptions().maxYear ?? this.scaleOptions.maxYear,
    });
    this.#axis.setData(this.#events, this.#scale);
  }

  #remembered(): string | null {
    if (this.getAttribute("remember") === "false") return null;
    const src = this.getAttribute("src");
    if (!src) return null;

    try {
      const saved = localStorage.getItem(memoryKey(src));
      return saved && this.#events.some((event) => event.id === saved)
        ? saved
        : null;
    } catch {
      // Private windows and blocked storage are not worth a failure here.
      return null;
    }
  }

  #remember(id: string): void {
    if (this.getAttribute("remember") === "false") return;
    const src = this.getAttribute("src");
    if (!src) return;

    try {
      localStorage.setItem(memoryKey(src), id);
    } catch {
      // Not being able to remember is not a reason to break the page.
    }
  }

  /* ------------------------------------------------------------------ */
  /* Chrome                                                             */
  /* ------------------------------------------------------------------ */

  #makeControls(): HTMLDivElement {
    const bar = document.createElement("div");
    bar.className = "bt-controls";

    const button = (
      key: string,
      label: string,
      icon: string,
      solid: boolean,
      onClick: () => void,
    ) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "bt-button";
      el.title = label;
      el.setAttribute("aria-label", label);
      el.innerHTML = icon;
      if (solid) el.dataset.solid = "";
      el.addEventListener("click", onClick);
      this.#buttons[key] = el;
      return el;
    };

    // Zoom on the left, stepping on the right: one changes how much you are
    // looking at, the other changes what.
    const zoom = document.createElement("div");
    zoom.className = "bt-zoom";
    zoom.append(
      button("out", "Zoom out", ICONS.minus, false, () => this.zoomBy(1 / ZOOM_STEP)),
      button("in", "Zoom in", ICONS.plus, false, () => this.zoomBy(ZOOM_STEP)),
      button("fit", "Fit the whole span", ICONS.reset, false, () => this.fit()),
    );

    const step = document.createElement("div");
    step.className = "bt-step";
    step.append(
      button("prev", "Previous event", ICONS.left, true, () => this.step(-1)),
      button("next", "Next event", ICONS.right, true, () => this.step(1)),
    );

    bar.append(zoom, step);
    this.#controls = bar;
    return bar;
  }

  #message(text: string): void {
    this.#frame.replaceChildren();
    const box = document.createElement("div");
    box.className = "bt-message";
    box.setAttribute("role", "status");
    const p = document.createElement("p");
    p.textContent = text;
    box.append(p);
    this.#frame.append(box);
  }

  /** Puts the real layout back after a message has replaced it. */
  #restoreFrame(): void {
    if (this.#frame.firstElementChild === this.#detail.el) return;
    this.#frame.replaceChildren(this.#detail.el, this.#controls, this.#axis.el);
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer.observe(this.#axis.el);
    }
  }

  /* ------------------------------------------------------------------ */
  /* View                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Keeps the axis over its own content.
   *
   * Without this the view can be zoomed or dragged clean off the end of the
   * timeline into blank space — no ticks, no markers, nothing to say which way
   * to go back. The far end of the span may reach the near edge of the box and
   * no further, in either direction; when the whole thing fits, it stays put.
   */
  #clamp(offset: number, pxPerUnit: number): number {
    if (this.#scale.total <= 0 || this.#width === 0) return offset;

    const content = this.#scale.total * pxPerUnit;
    const margin = this.#width * EDGE_PADDING;

    // When the whole span already fits — which is the opening view — the two
    // limits meet and the axis simply holds still, because there is nowhere
    // else for it to be. Letting that case through unclamped is what allows the
    // first drag on a freshly loaded page to throw every marker off the side.
    return Math.min(margin, Math.max(this.#width - margin - content, offset));
  }

  get #minZoom(): number {
    return fitZoom(this.#scale.total, this.#width, EDGE_PADDING);
  }

  #schedule(): void {
    if (this.#raf === null) {
      this.#raf = requestAnimationFrame(() => this.#commit());
    }
  }

  #commit(): void {
    this.#raf = null;

    const slide = this.#glide;
    if (slide) {
      const t = Math.min(1, (performance.now() - slide.start) / GLIDE_MS);
      const e = easeOut(t);
      this.#view.pxPerUnit = slide.fromPx + (slide.toPx - slide.fromPx) * e;
      this.#view.offset =
        slide.fromOffset + (slide.toOffset - slide.fromOffset) * e;
      if (t >= 1) this.#glide = null;
    }

    this.#view.offset = this.#clamp(this.#view.offset, this.#view.pxPerUnit);

    this.#axis.render({
      pxPerUnit: this.#view.pxPerUnit,
      offset: this.#view.offset,
      width: this.#width,
      height: this.#axis.el.clientHeight,
      selectedId: this.#selectedId,
    });

    this.#syncButtons();

    if (this.#glide) this.#schedule();
  }

  #syncButtons(): void {
    const at = this.#ordered.findIndex((event) => event.id === this.#selectedId);
    const { prev, next, out, in: zin } = this.#buttons;

    if (prev) prev.disabled = at <= 0;
    if (next) next.disabled = at === -1 || at >= this.#ordered.length - 1;
    if (out) out.disabled = this.#view.pxPerUnit <= this.#minZoom * 1.001;
    if (zin) zin.disabled = this.#view.pxPerUnit >= this.#scale.maxPxPerUnit;
  }

  /**
   * Where the view is *heading*, which is not where it is.
   *
   * A glide takes some hundreds of milliseconds, and anything starting a new
   * move during one has to build on the destination rather than on whatever
   * frame the tween happens to be showing. Reading the live value instead is
   * why three quick presses of a zoom button add up to a single step: presses
   * two and three each recompute the same target from a number that has barely
   * begun to move.
   */
  #pending(): { pxPerUnit: number; offset: number } {
    return this.#glide
      ? { pxPerUnit: this.#glide.toPx, offset: this.#glide.toOffset }
      : { ...this.#view };
  }

  #glideTo(targetOffset: number, targetPx = this.#view.pxPerUnit): void {
    this.#glide = {
      fromPx: this.#view.pxPerUnit,
      toPx: targetPx,
      fromOffset: this.#view.offset,
      toOffset: this.#clamp(targetOffset, targetPx),
      start: performance.now(),
    };
    this.#schedule();
  }

  #maybeFit(): void {
    if (this.#fitted || this.#scale.total <= 0 || this.#width === 0) return;
    this.#fitted = true;

    // On the first pass there is nothing on screen yet, so there is nothing to
    // travel from — later presses of the reset button animate like the rest.
    this.#view = { pxPerUnit: this.#minZoom, offset: this.#width * EDGE_PADDING };

    // Then put whatever is selected in the middle. Zoom pivots on the
    // selection, so if it starts off to one side every zoom drifts away from
    // the thing being read.
    const chosen = this.selected;
    if (chosen) {
      this.#view.offset =
        this.#width / 2 - yearToUnit(this.#scale, chosen.from) * this.#view.pxPerUnit;
    }
    this.#schedule();
  }

  /** Whole span in view, with a margin either side. */
  fit(): void {
    if (this.#scale.total <= 0 || this.#width === 0) return;
    this.#glideTo(this.#width * EDGE_PADDING, this.#minZoom);
  }

  /** Where the axis should pivot: the selected event, or dead centre. */
  #anchor(): number {
    const chosen = this.selected;
    if (!chosen) return this.#width / 2;

    const { pxPerUnit, offset } = this.#pending();
    const x = yearToUnit(this.#scale, chosen.from) * pxPerUnit + offset;

    // Off screen, the middle is a better pivot than a point nobody can see.
    return x < 0 || x > this.#width ? this.#width / 2 : x;
  }

  zoomBy(factor: number, anchorX = this.#anchor()): void {
    const from = this.#pending();
    const target = zoomAbout(
      from.pxPerUnit,
      from.offset,
      anchorX,
      factor,
      this.#minZoom,
      this.#scale.maxPxPerUnit,
    );
    this.#glideTo(target.offset, target.pxPerUnit);
  }

  /* ------------------------------------------------------------------ */
  /* Reading                                                            */
  /* ------------------------------------------------------------------ */

  #select(id: string | null, announce = true): void {
    this.#selectedId = id;
    this.#detail.show(this.selected);
    if (id) this.#remember(id);
    this.#syncButtons();

    if (announce && this.selected) {
      this.dispatchEvent(
        new CustomEvent("besttime:select", {
          detail: { event: this.selected },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  /**
   * Selects an event and slides it to the middle.
   *
   * Always, not only when it is off screen: picking something is a decision to
   * look at it, and having it settle in the same place every time is what makes
   * stepping through with the arrows readable.
   */
  focusEvent(id: string): void {
    this.#select(id);

    const event = this.#events.find((entry) => entry.id === id);
    if (!event || this.#width === 0) return;

    const unit = yearToUnit(this.#scale, event.from);
    const { pxPerUnit } = this.#pending();
    this.#glideTo(this.#width / 2 - unit * pxPerUnit, pxPerUnit);
  }

  /** Walks the timeline in the order it happened. */
  step(direction: -1 | 1): void {
    if (this.#ordered.length === 0) return;

    const at = this.#ordered.findIndex((event) => event.id === this.#selectedId);
    const next =
      at === -1
        ? 0
        : Math.min(this.#ordered.length - 1, Math.max(0, at + direction));
    this.focusEvent(this.#ordered[next].id);
  }

  // Arrow keys walk the timeline in order, which is how anyone reading it
  // rather than exploring it will want to move. Only while the axis holds
  // focus, so a page with two timelines on it does not move both at once.
  #onKey = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const active = this.#shadow.activeElement ?? document.activeElement;
    if (!active || !this.#axis.el.contains(active as Node)) return;

    event.preventDefault();
    this.step(event.key === "ArrowRight" ? 1 : -1);
  };

  #bindAxis(): void {
    const surface = this.#axis.el;

    surface.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      this.#drag = {
        active: true,
        x: event.clientX,
        offset: this.#view.offset,
        moved: false,
      };
    });

    surface.addEventListener("pointermove", (event) => {
      if (!this.#drag.active) return;

      const dx = event.clientX - this.#drag.x;
      if (!this.#drag.moved && Math.abs(dx) > 3) {
        this.#drag.moved = true;
        surface.setPointerCapture(event.pointerId);
        surface.dataset.panning = "";
        // A drag is a decision to travel, and finishing one should not also
        // land wherever the tween was heading.
        this.#glide = null;
      }
      if (!this.#drag.moved) return;

      this.#view.offset = this.#drag.offset + dx;
      this.#schedule();
    });

    const release = () => {
      this.#drag.active = false;
      delete surface.dataset.panning;
    };
    surface.addEventListener("pointerup", release);
    surface.addEventListener("pointercancel", release);

    // A drag that travelled must not also count as a click on whatever it
    // finished over.
    surface.addEventListener(
      "click",
      (event) => {
        if (this.#drag.moved) {
          event.stopPropagation();
          this.#drag.moved = false;
        }
      },
      true,
    );

    // Not passive, because this has to preventDefault or the page scrolls
    // instead of the axis zooming.
    surface.addEventListener(
      "wheel",
      (event) => {
        const rect = surface.getBoundingClientRect();
        const lines = event.deltaMode === 1 ? 16 : 1;

        event.preventDefault();

        // Trackpads send horizontal deltas for a two-finger swipe: that is a
        // pan, and only the vertical component is a zoom.
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          this.#view.offset -= event.deltaX * lines;
          this.#schedule();
          return;
        }

        this.#view = zoomAbout(
          this.#view.pxPerUnit,
          this.#view.offset,
          event.clientX - rect.left,
          Math.exp((-event.deltaY * lines) / 420),
          this.#minZoom,
          this.#scale.maxPxPerUnit,
        );
        this.#schedule();
      },
      { passive: false },
    );
  }
}
