import { describe, expect, it } from "vitest";

import {
  fromFractionalYear,
  readProse,
  readSpan,
  toFractionalYear,
} from "../src/prose";

/** Fixed, so a test written today still passes in 2031. */
const NOW = 2026;
const options = { now: NOW, maxYear: NOW };

const span = (text: string) => readProse(text, options);

describe("readProse", () => {
  it("reads a bare year", () => {
    expect(span("1969")).toMatchObject({ from: 1969, to: 1969 });
  });

  it("reads a decade as the ten years it names", () => {
    expect(span("1970s")).toMatchObject({ from: 1970, to: 1979 });
  });

  it("runs a decade to the present when it says so", () => {
    expect(span("1970s-present")).toMatchObject({ from: 1970, to: NOW });
  });

  it("reads an explicit range", () => {
    expect(span("1519-1544")).toMatchObject({ from: 1519, to: 1544 });
  });

  it("reads an en-dash range", () => {
    expect(span("1914–1918")).toMatchObject({ from: 1914, to: 1918 });
  });

  it("reads a century", () => {
    expect(span("21st century")).toMatchObject({ from: 2001, to: NOW });
  });

  it("reads a century spanning two ordinals", () => {
    const result = span("late 20th-21st c.");
    expect(result?.from).toBeGreaterThan(1900);
    expect(result?.to).toBe(NOW);
  });

  it("reads BCE as negative", () => {
    const result = span("700 BCE");
    expect(result?.from).toBe(-700);
  });

  it("does not mistake the CE inside BCE for a positive era", () => {
    expect(span("500 BCE")?.from).toBeLessThan(0);
    expect(span("500 CE")?.from).toBe(500);
  });

  it("marks everything it infers as approximate", () => {
    expect(span("21st century")?.approximate).toBe(true);
  });

  it("holds a span inside maxYear", () => {
    // A century that runs past the present is cut off at it. Otherwise an axis
    // built from these spans reserves most of its width for years in which,
    // definitionally, nothing has happened.
    expect(span("21st century")?.to).toBe(NOW);
  });

  it("lets a roadmap run into the future when told to", () => {
    const future = readProse("21st century", { now: NOW, maxYear: Infinity });
    expect(future?.to).toBe(2100);
  });

  it("gives up on prose with nothing in it", () => {
    expect(span("")).toBeNull();
    expect(span("sometime, probably")).toBeNull();
  });
});

describe("calendar dates", () => {
  it("reads ISO", () => {
    const result = span("2020-03-15");
    expect(result?.approximate).toBe(false);
    expect(fromFractionalYear(result!.from)).toMatchObject({
      year: 2020,
      month: 3,
      day: 15,
    });
  });

  it("reads a written date", () => {
    const result = span("March 15, 2020");
    expect(fromFractionalYear(result!.from)).toMatchObject({
      year: 2020,
      month: 3,
      day: 15,
    });
  });

  it("reads a day-first date", () => {
    const result = span("15 March 2020");
    expect(fromFractionalYear(result!.from)).toMatchObject({
      year: 2020,
      month: 3,
      day: 15,
    });
  });

  it("treats a month with no day as the whole month", () => {
    const result = span("2020-03");
    expect(result!.to).toBeGreaterThan(result!.from);
    expect(fromFractionalYear(result!.from).month).toBe(3);
  });
});

describe("fractional years round-trip", () => {
  it("survives a normal year", () => {
    for (const [month, day] of [
      [1, 1],
      [3, 15],
      [7, 4],
      [12, 31],
    ]) {
      const back = fromFractionalYear(toFractionalYear(2021, month, day));
      expect([back.month, back.day]).toEqual([month, day]);
    }
  });

  it("survives a leap year, including the day itself", () => {
    for (const [month, day] of [
      [2, 29],
      [3, 1],
      [12, 31],
    ]) {
      const back = fromFractionalYear(toFractionalYear(2020, month, day));
      expect([back.month, back.day]).toEqual([month, day]);
    }
  });
});

describe("readSpan", () => {
  it("prefers the date column, and calls it exact", () => {
    const result = readSpan("1969", "sometime in the sixties", options);
    expect(result).toMatchObject({ from: 1969, to: 1969, approximate: false });
  });

  it("falls back to prose when the date column is empty", () => {
    expect(readSpan("", "1970s", options)).toMatchObject({
      from: 1970,
      approximate: true,
    });
  });

  it("reads a real date parked in a column headed Year", () => {
    const result = readSpan("2020-03-15", "", options);
    expect(result?.approximate).toBe(false);
  });

  it("reads a negative year as BCE", () => {
    expect(readSpan("-700", "", options)).toMatchObject({ from: -700 });
  });
});
