import {
  packLanes,
  ticksFor,
  yearToUnit,
  type Scale,
  type TimelineEvent,
} from "@besttime/core";

/**
 * The lower half: a fixed baseline, ticks, and a marker per event.
 *
 * Every position is a unit on the compressed axis, so collapsed stretches take
 * a fixed width and the space goes where the events are. A break mark sits over
 * each collapsed gap — the timeline says out loud where it has skipped rather
 * than quietly misrepresenting a distance.
 *
 * Three rules the layout keeps, in this order:
 *
 *  1. **Every dot sits on the line.** A marker's dot is pinned to the baseline
 *     whatever row its label ended up in; the stem is what reaches up. A dot
 *     floating in mid-air says nothing about when something happened.
 *  2. **Nothing overlaps.** Rows are assigned from measured label widths, with
 *     no cap on how many rows are used.
 *  3. **Everything stays visible.** Which follows from the first two: crowding
 *     pushes labels up rather than dropping them, so a zoomed-in view with
 *     three events on screen puts all three on one line.
 *
 * Nodes are made once per event and then only moved. A wheel gesture fires
 * dozens of times a second, and rebuilding the DOM on each one is the
 * difference between this gliding and stuttering.
 */

/** Vertical step between label rows. */
const LANE_HEIGHT = 30;

/** Height of the tick band under the baseline. Matches `.bt-ticks` in the CSS. */
const RULER = 52;

/**
 * Label lengths to try, longest first.
 *
 * Rows are only unlimited in principle — the axis has a height, and a stack
 * that outgrows it puts the modern cluster above the top edge where nothing can
 * be seen. Rather than clip, the layout shortens the labels until the stack
 * fits, and only falls back to bare dots if even the shortest will not.
 */
const LABEL_BUDGETS = [24, 16, 10] as const;

/** Top margin kept clear, so the tallest row is not flush with the edge. */
const HEAD_ROOM = 18;

/** Rough width of the label font, for measuring without laying anything out. */
const CHAR_PX = 7.2;
const LABEL_PADDING = 20;

/** How wide a label may grow when the pointer is on it. */
const HOVER_MAX_PX = 460;

type MarkerNodes = {
  button: HTMLButtonElement;
  stem: HTMLSpanElement;
  label: HTMLSpanElement;
  bar: HTMLSpanElement;
  dot: HTMLSpanElement;
};

export type AxisState = {
  pxPerUnit: number;
  offset: number;
  width: number;
  height: number;
  selectedId: string | null;
};

export class Axis {
  readonly el: HTMLDivElement;

  #ticks: HTMLDivElement;
  #baseline: HTMLDivElement;
  #breaks: HTMLDivElement;
  #markersLayer: HTMLDivElement;

  #tickPool: HTMLDivElement[] = [];
  #breakPool: HTMLDivElement[] = [];
  #markers = new Map<string, MarkerNodes>();

  #events: TimelineEvent[] = [];
  #scale: Scale = { segments: [], total: 1, range: 1, maxPxPerUnit: 1400 };

  constructor(
    private readonly doc: Document,
    private readonly onSelect: (id: string) => void,
  ) {
    this.el = doc.createElement("div");
    this.el.className = "bt-axis";
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "group");
    this.el.setAttribute("aria-label", "Timeline");
    this.el.setAttribute("part", "axis");

    this.#ticks = doc.createElement("div");
    this.#ticks.className = "bt-ticks";

    this.#baseline = doc.createElement("div");
    this.#baseline.className = "bt-baseline";

    this.#breaks = doc.createElement("div");
    this.#breaks.style.position = "absolute";
    this.#breaks.style.inset = "0";
    this.#breaks.style.pointerEvents = "none";

    this.#markersLayer = doc.createElement("div");
    this.#markersLayer.className = "bt-markers";

    this.el.append(this.#ticks, this.#baseline, this.#breaks, this.#markersLayer);
  }

  setData(events: TimelineEvent[], scale: Scale): void {
    this.#events = events;
    this.#scale = scale;

    // Nodes for events that no longer exist, when a sheet is swapped live.
    for (const [id, nodes] of this.#markers) {
      if (!events.some((event) => event.id === id)) {
        nodes.button.remove();
        this.#markers.delete(id);
      }
    }

    for (const event of events) {
      if (!this.#markers.has(event.id)) {
        this.#markers.set(event.id, this.#makeMarker(event));
      }
    }
  }

  #makeMarker(event: TimelineEvent): MarkerNodes {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "bt-marker";
    button.setAttribute("part", "marker");

    const stem = this.doc.createElement("span");
    stem.className = "bt-stem";

    const label = this.doc.createElement("span");
    label.className = "bt-label";
    label.textContent = event.headline;
    label.style.setProperty("--bt-hover-max", `${HOVER_MAX_PX}px`);

    const bar = this.doc.createElement("span");
    bar.className = "bt-bar";
    if (event.approximate) bar.dataset.approximate = "";

    const dot = this.doc.createElement("span");
    dot.className = "bt-dot";

    button.append(stem, label, bar, dot);
    button.addEventListener("click", () => this.onSelect(event.id));

    this.#markersLayer.append(button);
    return { button, stem, label, bar, dot };
  }

  /**
   * Lays out and paints one frame.
   *
   * Called from an animation frame, so everything here is a write to a node
   * that already exists. Anything that would allocate belongs in `setData`.
   */
  render(state: AxisState): void {
    this.#renderTicks(state);
    this.#renderBreaks(state);
    this.#renderMarkers(state);
  }

  #renderTicks({ pxPerUnit, offset, width }: AxisState): void {
    const ticks = ticksFor(this.#scale, pxPerUnit, offset, width);

    let used = 0;
    for (const tick of ticks) {
      const x = tick.unit * pxPerUnit + offset;
      if (x < -60 || x > width + 60) continue;

      let node = this.#tickPool[used];
      if (!node) {
        node = this.doc.createElement("div");
        node.className = "bt-tick";
        node.innerHTML =
          '<div class="bt-tick-mark"></div><span class="bt-tick-label"></span>';
        this.#tickPool.push(node);
        this.#ticks.append(node);
      }

      node.style.transform = `translateX(${x}px)`;
      node.style.display = "";
      if (tick.major) delete node.dataset.minor;
      else node.dataset.minor = "";

      const label = node.lastElementChild as HTMLSpanElement;
      label.textContent = tick.label ?? "";

      used += 1;
    }

    for (let i = used; i < this.#tickPool.length; i += 1) {
      this.#tickPool[i].style.display = "none";
    }
  }

  #renderBreaks({ pxPerUnit, offset, width }: AxisState): void {
    const collapsed = this.#scale.segments.filter((segment) => segment.collapsed);

    let used = 0;
    for (const segment of collapsed) {
      const x = (segment.unit + segment.span / 2) * pxPerUnit + offset;
      if (x < -40 || x > width + 40) continue;

      let node = this.#breakPool[used];
      if (!node) {
        node = this.doc.createElement("div");
        node.className = "bt-break";
        node.innerHTML = "<span></span><span></span>";
        this.#breakPool.push(node);
        this.#breaks.append(node);
      }

      node.style.left = `${x}px`;
      node.style.display = "";

      const years = Math.round(segment.to - segment.from);
      node.title = `${years.toLocaleString("en-US")} years with nothing recorded`;

      used += 1;
    }

    for (let i = used; i < this.#breakPool.length; i += 1) {
      this.#breakPool[i].style.display = "none";
    }
  }

  #renderMarkers(state: AxisState): void {
    const { pxPerUnit, offset, width, height, selectedId } = state;

    const rows = Math.max(
      1,
      Math.floor((height - RULER - HEAD_ROOM) / LANE_HEIGHT),
    );

    const layout = (budget: number) => {
      const measured = this.#events.map((event) => {
        const x = yearToUnit(this.#scale, event.from) * pxPerUnit + offset;
        const end = yearToUnit(this.#scale, event.to) * pxPerUnit + offset;
        const span = Math.max(0, end - x);

        // Two widths per event: what it takes collapsed, and what it takes with
        // the whole headline showing. Rows are decided on the collapsed one so
        // the stack does not reshuffle every time the selection moves.
        const widthOf = (chars: number) => chars * CHAR_PX + LABEL_PADDING;
        const shut = widthOf(Math.min(event.headline.length, budget));
        const open = widthOf(event.headline.length);

        // A label is centred on a point and left-aligned on a span, so its box
        // is measured from wherever it actually starts.
        const boxFor = (labelWidth: number) => {
          const left = span > 2 ? x : x - labelWidth / 2;
          // The row has to clear both the words and the bar under them.
          return { left, right: Math.max(left + labelWidth, x + span) };
        };

        return {
          event,
          x,
          span,
          labelWidth: event.id === selectedId ? open : shut,
          box: boxFor(shut),
          openBox: boxFor(open),
        };
      });

      // Everything at its collapsed width first: that is the layout the reader
      // is already looking at, and the selected event's row is taken from it.
      const boxes = measured.map((entry) => entry.box);
      const chosen = measured.findIndex(
        (entry) => entry.event.id === selectedId,
      );

      let lanes: number[];
      if (chosen === -1) {
        lanes = packLanes(boxes);
      } else {
        const settled = packLanes(boxes)[chosen];
        boxes[chosen] = measured[chosen].openBox;
        lanes = packLanes(boxes, 6, { index: chosen, lane: settled });
      }

      const tallest = lanes.reduce((high, lane) => Math.max(high, lane), 0);
      return { measured, lanes, tallest };
    };

    // Shortest labels that still fit the box, and only then give up on words.
    let chosen = layout(LABEL_BUDGETS[0]);
    for (const budget of LABEL_BUDGETS) {
      chosen = layout(budget);
      if (chosen.tallest < rows) break;
    }

    chosen.measured.forEach((entry, index) => {
      const nodes = this.#markers.get(entry.event.id);
      if (!nodes) return;

      const { button, stem, label, bar, dot } = nodes;
      const { event, x, span, labelWidth } = entry;

      // Off screen by more than a label's reach: nothing to paint.
      if (x + span < -240 || x > width + 240) {
        button.style.display = "none";
        return;
      }
      button.style.display = "";

      const lane = Math.min(chosen.lanes[index], rows - 1);
      // Beyond the last row there is nowhere to put words without covering
      // something. The dot stays on the line, so the event is still there.
      const labelled = chosen.lanes[index] < rows;
      const selected = event.id === selectedId;
      const show = labelled || selected;
      const lift = show ? 13 + lane * LANE_HEIGHT : 8;
      const spanned = span > 2;

      button.style.transform = `translateX(${x}px)`;
      // Depth as a variable rather than an inline z-index, so hovering can lift
      // a marker over its neighbours — an expanded label is no use if the row
      // above is painted on top of it.
      button.style.setProperty("--bt-z", String(selected ? 30 : 10 + lane));
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-label",
        `${event.displayDate}: ${event.headline}`,
      );
      if (selected) button.dataset.selected = "";
      else delete button.dataset.selected;

      stem.style.height = `${lift}px`;

      label.hidden = !show;
      if (show) {
        label.style.bottom = `${lift}px`;
        label.style.setProperty("--bt-w", `${labelWidth}px`);
        if (spanned) delete label.dataset.centred;
        else label.dataset.centred = "";
      }

      bar.hidden = !spanned;
      if (spanned) {
        bar.style.width = `${span}px`;
        // Directly under its own label rather than on the baseline. Rows
        // already guarantee labels do not collide, and the row was measured
        // against the bar's full length — so putting the bar in the same row is
        // what stops six modern spans fusing into one dark smear on the line.
        bar.style.bottom = `${lift - 9}px`;
      }

      // The dot is positioned entirely in CSS; it only ever changes colour and
      // scale, both of which follow from the selected attribute above.
      void dot;
    });
  }
}
