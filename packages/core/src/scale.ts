import { fromFractionalYear } from "./prose";
import type { ScaleOptions } from "./types";

/**
 * The axis's arithmetic.
 *
 * Two ideas do the work.
 *
 * **Zoom is one continuous number**, pixels per unit, rather than a handful of
 * named levels. Named levels are why most timelines snap: with nothing between
 * "decades" and "years" a zoom is a jump between two layouts and cannot be
 * animated. Here the ticks are *chosen* from the current zoom, so the axis
 * re-labels itself as it moves and every frame in between is a real one.
 *
 * **The axis is piecewise.** Data that runs from 700 BCE to now, with four
 * events before year zero and thirteen after 1900, is almost all empty on a
 * straight axis — and the interesting parts are unreadably tight. Stretches
 * with nothing in them are collapsed to a fixed width and marked with a break,
 * so the space goes where the events are. `unit` is that compressed coordinate;
 * everything on screen is positioned in it, and only ticks and labels convert
 * back to years.
 *
 * Nothing here knows what a pixel looks like or which framework is drawing it.
 */

/**
 * Rungs, coarse to fine, in years.
 *
 * One ladder for every dataset rather than a ladder chosen per timeline. The
 * rung is picked from the current zoom, so a conference schedule reaches days
 * and an geological chart stops at a hundred thousand years — the same code,
 * reading the same number.
 *
 * The intermediate rungs — 500, 250, 50, 25, 5 — are deliberately absent: they
 * let a major tick land on a quarter-century, which reads as an arbitrary
 * number rather than as a scale anyone thinks in.
 */
export const LADDER = [
  1_000_000, 100_000, 10_000, 1_000, 100, 10, 1, 1 / 12, 1 / 365,
] as const;

/** A major tick needs at least this much room, or its label collides. */
const MAJOR_MIN_PX = 92;

/** A minor tick below this is visual noise. */
const MINOR_MIN_PX = 8;

/**
 * An absolute floor, well below anything the axis actually uses.
 *
 * The working minimum is the zoom at which the whole span fits the box, which
 * depends on how wide the box is and so cannot be a constant — see `fitZoom`.
 * This one only exists so the arithmetic has a bottom in the moment before a
 * width has been measured.
 */
export const MIN_PX_PER_UNIT = 1e-9;

/** How much one press of the zoom buttons changes things. */
export const ZOOM_STEP = 1.6;

export type Segment = {
  from: number;
  to: number;
  /** Where this segment starts along the compressed axis. */
  unit: number;
  /** Its width in units: its real length, or `gapUnits` if collapsed. */
  span: number;
  collapsed: boolean;
};

export type Scale = {
  segments: Segment[];
  total: number;
  /** The real range the data covers, before any collapsing. */
  range: number;
  /** How far in this particular dataset is worth zooming. */
  maxPxPerUnit: number;
};

export type Tick = { unit: number; label?: string; major: boolean };

/**
 * How far in the axis goes, for data of this range.
 *
 * A month is a twelfth of a unit, so months only become a usable rung once a
 * whole year is wider than a label. Deriving the ceiling from the range is what
 * lets one component serve both a single afternoon and the Pleistocene: a
 * century-scale timeline stops at months because days are noise on it, and a
 * fifty-year one keeps going until a day is legible.
 */
export function maxZoomFor(range: number): number {
  const finest = range > 1000 ? 1 / 12 : 1 / 365;
  return Math.min(200_000, Math.max(1400, (MAJOR_MIN_PX / finest) * 3));
}

export const clampZoom = (
  value: number,
  floor = MIN_PX_PER_UNIT,
  ceiling = 1400,
) => Math.min(ceiling, Math.max(floor, value));

/**
 * The zoom that shows everything, with a margin either side.
 *
 * Also the widest the axis will go. Zooming out past the point where the whole
 * history is on screen only adds blank paper on both sides — there is nothing
 * further out to see.
 */
export function fitZoom(total: number, width: number, padding: number): number {
  if (total <= 0 || width <= 0) return MIN_PX_PER_UNIT;
  return Math.max(MIN_PX_PER_UNIT, (width * (1 - padding * 2)) / total);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * How a tick reads.
 *
 * A bare "-700" is a number, not a date. Eras are spelled out so the axis says
 * what it means, and the year itself is written positively — nobody writes
 * "negative seven hundred BCE". Anything in the first millennium gets CE for
 * the same reason: "95" alone is ambiguous where "95 CE" is not.
 */
export function formatYear(year: number, rung = 1): string {
  // Below a month, the label is a day.
  if (rung < 1 / 12) {
    const { year: y, month, day } = fromFractionalYear(year);
    // The first of a month carries the month with it, and January carries the
    // year: a column of bare numbers tells you nothing about where you are.
    if (day === 1) {
      return month === 1
        ? `${MONTHS[0]} ${formatYear(y, 1)}`
        : `${MONTHS[month - 1]} 1`;
    }
    return `${MONTHS[month - 1]} ${day}`;
  }

  // Below a year, the label is the month. A date with no month stated sits at
  // January, so a whole-year value reads as the start of that year.
  if (rung < 1) {
    const whole = Math.floor(year + 1e-9);
    const month = Math.round((year - whole) * 12);
    const name = MONTHS[((month % 12) + 12) % 12];
    return month === 0 ? `${name} ${formatYear(whole, 1)}` : name;
  }

  const value = Math.round(year);
  if (value <= -1_000_000) return `${(Math.abs(value) / 1e6).toFixed(1)}M BCE`;
  if (value < 0) return `${Math.abs(value).toLocaleString("en-US")} BCE`;
  if (value === 0) return "1 CE";
  if (value < 1000) return `${value} CE`;
  if (value >= 1_000_000) return `${(value / 1e6).toFixed(1)}M CE`;
  return String(value);
}

/**
 * How much quiet to keep either side of an event.
 *
 * Derived from the spacing between events rather than from the total range,
 * and that distinction is the whole reason one component can draw a conference
 * schedule and an ice age. A fraction of the range looks reasonable until the
 * data is lopsided: on a history running 700 BCE to now, 2% of the range is 54
 * years, so each isolated ancient event swells into a segment wider than the
 * entire modern cluster that holds most of the events. Spacing does not have
 * that failure — it says how far apart these events actually are, whatever
 * units they are measured in.
 *
 * The 25th percentile rather than the median, because a lopsided timeline is
 * the normal case and the sparse end would otherwise set the padding for the
 * dense one.
 */
function typicalSpacing(spans: Array<{ from: number; to: number }>): number {
  const starts = spans.map((span) => span.from).sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    const gap = starts[i] - starts[i - 1];
    if (gap > 0) gaps.push(gap);
  }

  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length * 0.25)];
}

/**
 * Builds the compressed axis from what the events actually occupy.
 *
 * Spans are padded, merged where they touch, and whatever is left between them
 * becomes a gap. Only gaps worth collapsing are collapsed — a quiet patch reads
 * as a pause, and removing a short one would make the timeline lie about how
 * far apart two events were.
 *
 * Every threshold is derived from the data rather than fixed in years, so the
 * same code compresses a product roadmap and the Pleistocene the same way. The
 * property that guarantees it: scaling every date by a constant produces an
 * identical axis.
 */
export function buildScale(
  spans: Array<{ from: number; to: number }>,
  options: ScaleOptions = {},
): Scale {
  if (spans.length === 0) {
    return { segments: [], total: 1, range: 1, maxPxPerUnit: 1400 };
  }

  const lo = Math.min(...spans.map((span) => span.from));
  const hi = Math.max(...spans.map((span) => span.to));
  const range = Math.max(1e-9, hi - lo);

  // Half the typical spacing, so two events that far apart just touch and read
  // as one cluster rather than being split by a break they do not deserve.
  const breathingRoom =
    options.breathingRoom ?? Math.max(typicalSpacing(spans) * 0.5, range * 0.002);

  const ceiling = options.maxYear ?? Infinity;
  const collapsing = options.collapseGaps ?? true;

  const padded = spans
    .map((span) => ({
      from: span.from - breathingRoom,
      to: Math.min(ceiling, span.to + breathingRoom),
    }))
    .sort((a, b) => a.from - b.from);

  const merged: Array<{ from: number; to: number }> = [];
  for (const span of padded) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }

  // How much of the axis has something on it. Both remaining thresholds are
  // measured against this rather than against the range, because the range of
  // a sparse timeline is mostly the emptiness being decided about — judging a
  // gap against a number it dominates is circular.
  const content = merged.reduce((sum, entry) => sum + (entry.to - entry.from), 0);

  // A gap is worth collapsing once it is comparable to the content around it.
  // Half is the threshold rather than the whole: requiring a gap to exceed
  // everything with something in it leaves a lopsided history barely
  // compressed — on a 700 BCE-to-now run only one gap in eight qualified, and
  // the sparse ancient end still took nearly half the axis, which is the exact
  // problem the compression exists to solve.
  const minGap = options.minGap ?? Math.max(range * 0.08, content * 0.5);

  // What a collapsed gap costs. Proportional to the content so that a timeline
  // with many gaps does not spend most of its width on break marks.
  const gapUnits =
    options.gapUnits ?? Math.max(content * 0.12, range * 0.002, 1e-9);

  const segments: Segment[] = [];
  let unit = 0;

  merged.forEach((entry, index) => {
    if (index > 0) {
      const gapFrom = merged[index - 1].to;
      const gapYears = entry.from - gapFrom;
      const collapsed = collapsing && gapYears >= minGap;
      const span = collapsed ? gapUnits : gapYears;

      segments.push({ from: gapFrom, to: entry.from, unit, span, collapsed });
      unit += span;
    }

    // A moment still needs width, or two events on the same day divide by zero.
    const span = Math.max(range * 1e-4, entry.to - entry.from);
    segments.push({ ...entry, unit, span, collapsed: false });
    unit += span;
  });

  return {
    segments,
    total: unit,
    range,
    maxPxPerUnit: maxZoomFor(range),
  };
}

/** A year's place on the compressed axis. */
export function yearToUnit(scale: Scale, year: number): number {
  const { segments } = scale;
  if (segments.length === 0) return 0;
  if (year <= segments[0].from) return 0;

  for (const segment of segments) {
    if (year > segment.to) continue;
    const width = Math.max(1e-9, segment.to - segment.from);
    return segment.unit + ((year - segment.from) / width) * segment.span;
  }

  return scale.total;
}

/** The inverse, for reading a position back as a year. */
export function unitToYear(scale: Scale, unit: number): number {
  const { segments } = scale;
  if (segments.length === 0) return 0;

  for (const segment of segments) {
    if (unit > segment.unit + segment.span) continue;
    const through = (unit - segment.unit) / Math.max(1e-9, segment.span);
    return segment.from + through * (segment.to - segment.from);
  }

  return segments[segments.length - 1].to;
}

/**
 * Ticks for what is on screen.
 *
 * Generated per segment, because the year-to-pixel ratio differs across a
 * collapsed axis — a rung that reads well over the 1900s would be far too fine
 * across a 700-year stretch. Collapsed gaps get no ticks at all; the break mark
 * is the label.
 */
export function ticksFor(
  scale: Scale,
  pxPerUnit: number,
  offset: number,
  width: number,
): Tick[] {
  const out: Tick[] = [];

  for (const segment of scale.segments) {
    if (segment.collapsed) continue;

    const left = segment.unit * pxPerUnit + offset;
    const right = (segment.unit + segment.span) * pxPerUnit + offset;
    if (right < -width || left > width * 2) continue;

    // The *finest* rung that still leaves room for a label, not the coarsest.
    // Scanning for the first that fits always returns the coarsest, whatever
    // the zoom, which is why so many axes never re-label as you zoom in.
    let majorIndex = 0;
    for (let i = 0; i < LADDER.length; i += 1) {
      if (LADDER[i] * pxPerUnit >= MAJOR_MIN_PX) majorIndex = i;
    }

    // Then finer again until a multiple of the rung actually falls inside this
    // segment. Segments are built around clusters of events and are often only
    // a few decades wide, so a coarse rung frequently misses one entirely — and
    // a rung that misses produces no ticks at all. Stepping down means a
    // thirty-year cluster gets decades, a three-year one gets years, and the
    // ladder visibly changes as you zoom.
    const lands = (years: number) =>
      Math.ceil(segment.from / years) * years <= segment.to;

    while (majorIndex + 1 < LADDER.length && !lands(LADDER[majorIndex])) {
      majorIndex += 1;
    }

    const major = LADDER[majorIndex];
    const minor = majorIndex + 1 < LADDER.length ? LADDER[majorIndex + 1] : null;
    const step = minor ?? major;

    // Walk only the stretch of the segment that is actually on screen.
    // Starting at `segment.from` and stepping by a day would spend the guard
    // centuries before the viewport was reached, leaving a deeply zoomed axis
    // with no ticks on it at all. Inside an uncollapsed segment a unit is a
    // year, so the conversion is a shift.
    const yearAt = (px: number) =>
      segment.from + ((px - offset) / pxPerUnit - segment.unit);

    const lo = Math.max(segment.from, yearAt(-width));
    const hi = Math.min(segment.to, yearAt(width * 2));

    const first = Math.ceil(lo / step) * step;
    let labelled = false;

    for (let year = first, guard = 0; year <= hi && guard < 600; year += step) {
      guard += 1;

      // Fractional rungs cannot use a remainder: floating point never lands
      // exactly on zero.
      const isMajor = Math.abs(year / major - Math.round(year / major)) < 1e-6;
      if (!isMajor && step * pxPerUnit < MINOR_MIN_PX) continue;
      if (isMajor) labelled = true;

      out.push({
        unit: yearToUnit(scale, year),
        major: isMajor,
        label: isMajor ? formatYear(year, major) : undefined,
      });
    }

    // A segment is often only a few decades wide, so a round-number rung can
    // miss it entirely and leave a cluster with no year against it. It still
    // gets one — but snapped to the finer rung rather than dropped on the raw
    // midpoint, so the label reads as part of the same scale as its neighbours
    // instead of an arbitrary number sitting between them.
    if (!labelled) {
      const snap = minor ?? major;
      const middle = (segment.from + segment.to) / 2;
      const year = Math.round(middle / snap) * snap;

      out.push({
        unit: yearToUnit(scale, year),
        major: true,
        label: formatYear(year, snap),
      });
    }
  }

  // MAJOR_MIN_PX only spaces labels *within* a segment. Across segments it
  // guarantees nothing: two clusters separated by a collapsed gap each get
  // their own label, and at a wide zoom those can land a few pixels apart,
  // which turns one end of the axis into an unreadable smear of years. So the
  // run is thinned once at the end, over every tick at once. The mark stays
  // either way; only the words go.
  out.sort((a, b) => a.unit - b.unit);

  // Adjacent segments share a boundary and both put a tick on it — two marks
  // at one position. Keep the more significant of any pair: a major outranks a
  // minor, and a labelled tick outranks a bare one.
  const unique: Tick[] = [];
  for (const tick of out) {
    const last = unique[unique.length - 1];
    if (last && Math.abs(last.unit - tick.unit) < 1e-6) {
      const better =
        (tick.major ? 2 : 0) + (tick.label ? 1 : 0) >
        (last.major ? 2 : 0) + (last.label ? 1 : 0);
      if (better) unique[unique.length - 1] = tick;
      continue;
    }
    unique.push(tick);
  }

  let lastLabelPx = -Infinity;
  for (const tick of unique) {
    if (!tick.label) continue;

    const x = tick.unit * pxPerUnit + offset;
    if (x - lastLabelPx < MAJOR_MIN_PX) {
      tick.label = undefined;
      continue;
    }
    lastLabelPx = x;
  }

  return unique;
}

/** Zooms about a point on screen, so what is under the cursor stays there. */
export function zoomAbout(
  pxPerUnit: number,
  offset: number,
  anchorX: number,
  factor: number,
  floor = MIN_PX_PER_UNIT,
  ceiling = 1400,
): { pxPerUnit: number; offset: number } {
  const next = clampZoom(pxPerUnit * factor, floor, ceiling);
  if (next === pxPerUnit) return { pxPerUnit, offset };

  const unitUnderAnchor = (anchorX - offset) / pxPerUnit;
  return { pxPerUnit: next, offset: anchorX - unitUnderAnchor * next };
}

/**
 * Packs boxes into rows so that none of them touch.
 *
 * Takes real left and right edges rather than a position and a minimum gap: a
 * label is centred on its marker and a span reaches to its end, so "where does
 * this actually start and stop" is the only question that keeps two of them
 * apart.
 *
 * Rows are unlimited. Requiring everything to be visible and requiring nothing
 * to overlap can only both hold if the stack is allowed to grow, so the caller
 * decides how tall it is willing to be rather than this dropping anything.
 *
 * `pin` fixes one box to a row it has already been given and packs everything
 * else around it. Selecting an event widens its label, and re-packing from
 * scratch would let the thing just clicked jump three rows up the stack — the
 * one element on screen that must not move is the one being looked at. So it
 * holds its place and its neighbours are the ones that shuffle.
 */
export function packLanes(
  boxes: Array<{ left: number; right: number }>,
  padding = 6,
  pin?: { index: number; lane: number },
): number[] {
  const rows: Array<Array<{ left: number; right: number }>> = [];
  const lanes: number[] = [];

  const clashes = (
    row: Array<{ left: number; right: number }>,
    box: { left: number; right: number },
  ) =>
    row.some(
      (taken) =>
        box.left < taken.right + padding && taken.left < box.right + padding,
    );

  if (pin) {
    while (rows.length <= pin.lane) rows.push([]);
    rows[pin.lane].push(boxes[pin.index]);
    lanes[pin.index] = pin.lane;
  }

  // Left to right, so a row fills in reading order.
  const order = boxes
    .map((box, index) => ({ ...box, index }))
    .filter((box) => box.index !== pin?.index)
    .sort((a, b) => a.left - b.left);

  for (const box of order) {
    let lane = rows.findIndex((row) => !clashes(row, box));
    if (lane === -1) {
      lane = rows.length;
      rows.push([]);
    }
    rows[lane].push(box);
    lanes[box.index] = lane;
  }

  return lanes;
}
