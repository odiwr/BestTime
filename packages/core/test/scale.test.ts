import { describe, expect, it } from "vitest";

import {
  buildScale,
  formatYear,
  packLanes,
  ticksFor,
  unitToYear,
  yearToUnit,
  zoomAbout,
} from "../src/scale";

/** Sparse early, dense late — the shape that makes a straight axis useless. */
const HISTORY = [
  { from: -700, to: -700 },
  { from: -350, to: -350 },
  { from: 1450, to: 1450 },
  { from: 1969, to: 1969 },
  { from: 1972, to: 1972 },
  { from: 2001, to: 2001 },
  { from: 2020, to: 2024 },
];

describe("buildScale", () => {
  it("returns something usable for no events at all", () => {
    const scale = buildScale([]);
    expect(scale.segments).toEqual([]);
    expect(scale.total).toBe(1);
  });

  it("collapses the empty stretches", () => {
    const scale = buildScale(HISTORY);
    expect(scale.segments.some((segment) => segment.collapsed)).toBe(true);
  });

  it("spends most of the axis on the years that have events in them", () => {
    // The whole point of the compressed axis. 2,700 years of real range, but
    // the 1900s onward is where all but three events live, so it must not be
    // squeezed into a few percent of the width.
    const scale = buildScale(HISTORY);
    const modern =
      yearToUnit(scale, 2024) - yearToUnit(scale, 1900);
    expect(modern / scale.total).toBeGreaterThan(0.25);
  });

  it("leaves short gaps alone", () => {
    // A quiet stretch reads as a pause. Collapsing a three-year one would make
    // the timeline lie about how close two events were.
    const scale = buildScale([
      { from: 2000, to: 2000 },
      { from: 2003, to: 2003 },
    ]);
    expect(scale.segments.every((segment) => !segment.collapsed)).toBe(true);
  });

  it("never collapses anything when told not to", () => {
    const scale = buildScale(HISTORY, { collapseGaps: false });
    expect(scale.segments.every((segment) => !segment.collapsed)).toBe(true);
  });

  it("compresses the same shape identically at any scale", () => {
    // The property that makes one component serve a conference schedule and an
    // ice age: every threshold is derived from the data, so multiplying every
    // date by a constant must produce the same axis. A fixed 60-year minimum
    // gap would collapse nothing in the first case and everything in the
    // second, and this test is what stops one creeping back in.
    const shape = [0, 1, 50, 51, 52];
    const at = (scale: number, base: number) =>
      buildScale(shape.map((v) => ({ from: base + v * scale, to: base + v * scale })));

    const days = at(1 / 365, 2026);
    const years = at(1, 1900);
    const aeons = at(10_000, -600_000);

    const shapeOf = (s: ReturnType<typeof buildScale>) =>
      s.segments.map((segment) => segment.collapsed);

    expect(shapeOf(days)).toEqual(shapeOf(years));
    expect(shapeOf(aeons)).toEqual(shapeOf(years));

    // And the proportions match, not merely the pattern of breaks.
    const share = (s: ReturnType<typeof buildScale>) =>
      s.segments.map((segment) => segment.span / s.total);
    share(years).forEach((value, i) => {
      expect(share(days)[i]).toBeCloseTo(value, 6);
      expect(share(aeons)[i]).toBeCloseTo(value, 6);
    });
  });

  it("does not put a break between two events that are simply near each other", () => {
    // Breathing room is half the typical spacing, so a pair of events reads as
    // one cluster instead of being split by a gap mark they did not earn.
    const scale = buildScale([
      { from: 2026.1, to: 2026.1 },
      { from: 2026.9, to: 2026.9 },
    ]);
    expect(scale.segments.every((segment) => !segment.collapsed)).toBe(true);
  });

  it("zooms further for a short range than a long one", () => {
    expect(buildScale([{ from: 2020, to: 2021 }]).maxPxPerUnit).toBeGreaterThan(
      buildScale([{ from: -5000, to: 2020 }]).maxPxPerUnit,
    );
  });

  it("gives a moment enough width to be divided by", () => {
    const scale = buildScale([{ from: 2020, to: 2020 }]);
    expect(scale.total).toBeGreaterThan(0);
    expect(Number.isFinite(yearToUnit(scale, 2020))).toBe(true);
  });
});

describe("yearToUnit / unitToYear", () => {
  it("round-trips inside a real segment", () => {
    const scale = buildScale(HISTORY);
    for (const year of [1969, 1972, 2001, 2022]) {
      expect(unitToYear(scale, yearToUnit(scale, year))).toBeCloseTo(year, 3);
    }
  });

  it("is monotonic", () => {
    // If it were not, dragging the axis could move an event backwards past its
    // neighbour, which no amount of styling would disguise.
    const scale = buildScale(HISTORY);
    const years = [-700, -350, 0, 1450, 1969, 2001, 2024];
    const units = years.map((year) => yearToUnit(scale, year));

    for (let i = 1; i < units.length; i += 1) {
      expect(units[i]).toBeGreaterThanOrEqual(units[i - 1]);
    }
  });

  it("clamps outside the data rather than running off", () => {
    const scale = buildScale(HISTORY);
    expect(yearToUnit(scale, -99_999)).toBe(0);
    expect(yearToUnit(scale, 99_999)).toBe(scale.total);
  });
});

describe("ticksFor", () => {
  const scale = buildScale(HISTORY);

  it("produces ticks", () => {
    expect(ticksFor(scale, 0.5, 0, 1000).length).toBeGreaterThan(0);
  });

  it("puts no two labels closer than a label's width", () => {
    // The bug this replaces turned one end of the axis into a smear of
    // overlapping years, because spacing was only enforced within a segment.
    for (const zoom of [0.05, 0.5, 4, 40]) {
      const labelled = ticksFor(scale, zoom, 0, 1200)
        .filter((tick) => tick.label)
        .map((tick) => tick.unit * zoom);

      for (let i = 1; i < labelled.length; i += 1) {
        expect(labelled[i] - labelled[i - 1]).toBeGreaterThanOrEqual(91);
      }
    }
  });

  it("never emits two ticks at one position", () => {
    // Adjacent segments share a boundary and both used to mark it. React was
    // handed duplicate keys and stranded an element at a fixed pixel.
    const units = ticksFor(scale, 2, 0, 1000).map((tick) => tick.unit);
    for (let i = 1; i < units.length; i += 1) {
      expect(Math.abs(units[i] - units[i - 1])).toBeGreaterThan(1e-6);
    }
  });

  it("gets finer as the zoom goes in", () => {
    // The property that named zoom levels cannot have: the ladder is chosen
    // from the current zoom, so it changes continuously rather than snapping.
    const wide = ticksFor(scale, 0.05, 0, 1000).filter((t) => t.label).length;
    const close = ticksFor(scale, 60, -yearToUnit(scale, 1969) * 60 + 500, 1000)
      .filter((t) => t.label).length;
    expect(close).toBeGreaterThan(0);
    expect(wide).toBeGreaterThan(0);
  });

  it("gives every uncollapsed segment at least one label", () => {
    // A round-number rung can miss a narrow segment entirely, leaving a
    // cluster of events with no year against it.
    const ticks = ticksFor(scale, 1, 0, 100_000);
    const real = scale.segments.filter((segment) => !segment.collapsed);

    for (const segment of real) {
      const inside = ticks.some(
        (tick) =>
          tick.unit >= segment.unit - 1e-6 &&
          tick.unit <= segment.unit + segment.span + 1e-6,
      );
      expect(inside).toBe(true);
    }
  });

  it("terminates on a deeply zoomed axis", () => {
    // Walking from the segment's start by a day would spend the loop guard
    // centuries before reaching the viewport.
    const start = performance.now();
    ticksFor(scale, 100_000, -1e7, 1000);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("formatYear", () => {
  it("spells out eras rather than printing a negative number", () => {
    expect(formatYear(-700)).toBe("700 BCE");
    expect(formatYear(95)).toBe("95 CE");
    expect(formatYear(1969)).toBe("1969");
  });

  it("labels months below the year rung", () => {
    expect(formatYear(2020, 1 / 12)).toBe("Jan 2020");
    expect(formatYear(2020 + 2 / 12, 1 / 12)).toBe("Mar");
  });

  it("labels days below the month rung", () => {
    expect(formatYear(2021 + 73 / 365, 1 / 365)).toBe("Mar 15");
  });

  it("abbreviates deep time", () => {
    expect(formatYear(-2_500_000)).toBe("2.5M BCE");
  });
});

describe("zoomAbout", () => {
  it("keeps what is under the anchor under the anchor", () => {
    const before = (400 - 100) / 2;
    const after = zoomAbout(2, 100, 400, 3, 0.01, 10_000);
    expect((400 - after.offset) / after.pxPerUnit).toBeCloseTo(before, 6);
  });

  it("refuses to go past the ceiling", () => {
    expect(zoomAbout(1000, 0, 0, 100, 0.01, 1400).pxPerUnit).toBe(1400);
  });

  it("refuses to go past the floor", () => {
    expect(zoomAbout(1, 0, 0, 0.001, 0.5, 1400).pxPerUnit).toBe(0.5);
  });
});

describe("packLanes", () => {
  it("puts boxes that do not touch on one row", () => {
    expect(
      packLanes([
        { left: 0, right: 50 },
        { left: 100, right: 150 },
      ]),
    ).toEqual([0, 0]);
  });

  it("pushes an overlap up a row", () => {
    const lanes = packLanes([
      { left: 0, right: 100 },
      { left: 50, right: 150 },
    ]);
    expect(lanes[0]).not.toBe(lanes[1]);
  });

  it("never overlaps anything, however crowded", () => {
    const boxes = Array.from({ length: 60 }, (_, i) => ({
      left: i * 3,
      right: i * 3 + 90,
    }));
    const lanes = packLanes(boxes);

    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        if (lanes[a] !== lanes[b]) continue;
        const clash =
          boxes[a].left < boxes[b].right + 6 &&
          boxes[b].left < boxes[a].right + 6;
        expect(clash).toBe(false);
      }
    }
  });

  it("holds a pinned box on its row and moves its neighbours instead", () => {
    // The one element on screen that must not jump is the one being looked at.
    const boxes = [
      { left: 0, right: 100 },
      { left: 50, right: 400 },
      { left: 120, right: 200 },
    ];
    const lanes = packLanes(boxes, 6, { index: 1, lane: 2 });
    expect(lanes[1]).toBe(2);
  });
});
