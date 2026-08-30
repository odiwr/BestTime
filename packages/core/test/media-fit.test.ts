import { describe, expect, it } from "vitest";

import { DEFAULT_FIT, parseMediaFit } from "../src/media";

/**
 * This value is written by a person into a spreadsheet cell, arrives over the
 * network, and ends up in a style attribute. So the tests that matter most are
 * not the happy ones — they are the ones proving that nothing which is not a
 * keyword or a percentage can get through.
 */
describe("parseMediaFit", () => {
  it("reads the position keywords", () => {
    expect(parseMediaFit("top")).toEqual({ fit: "cover", position: "50% 0%" });
    expect(parseMediaFit("bottom")).toEqual({ fit: "cover", position: "50% 100%" });
    expect(parseMediaFit("left")).toEqual({ fit: "cover", position: "0% 50%" });
    expect(parseMediaFit("right")).toEqual({ fit: "cover", position: "100% 50%" });
  });

  it("reads two keywords together", () => {
    expect(parseMediaFit("top left")).toEqual({ fit: "cover", position: "0% 0%" });
    expect(parseMediaFit("bottom right")).toEqual({
      fit: "cover",
      position: "100% 100%",
    });
  });

  it("treats a lone percentage as vertical", () => {
    // The reason anyone reaches for this is a subject too high or too low in
    // frame, so the single number they type should move it up or down.
    expect(parseMediaFit("25%")).toEqual({ fit: "cover", position: "50% 25%" });
  });

  it("accepts a bare number as a percentage", () => {
    // People write "20" as often as "20%", and rejecting the first would be
    // pedantry in a spreadsheet cell.
    expect(parseMediaFit("20")).toEqual({ fit: "cover", position: "50% 20%" });
  });

  it("reads two percentages as x then y, like CSS", () => {
    expect(parseMediaFit("30% 70%")).toEqual({
      fit: "cover",
      position: "30% 70%",
    });
  });

  it("switches to contain on any of the words people use for it", () => {
    for (const word of ["contain", "fit", "whole", "full", "letterbox"]) {
      expect(parseMediaFit(word)?.fit).toBe("contain");
    }
  });

  it("combines a fit with a position", () => {
    expect(parseMediaFit("contain top")).toEqual({
      fit: "contain",
      position: "50% 0%",
    });
  });

  it("is case and separator insensitive", () => {
    expect(parseMediaFit("  TOP  LEFT ")).toEqual({
      fit: "cover",
      position: "0% 0%",
    });
    expect(parseMediaFit("top,left")).toEqual({ fit: "cover", position: "0% 0%" });
  });

  it("accepts the centre spellings and does nothing with them", () => {
    for (const word of ["center", "centre", "middle"]) {
      expect(parseMediaFit(word)).toEqual(DEFAULT_FIT);
    }
  });

  it("returns null for nothing at all", () => {
    expect(parseMediaFit(undefined)).toBeNull();
    expect(parseMediaFit("")).toBeNull();
    expect(parseMediaFit("   ")).toBeNull();
  });

  it("returns null when it understood none of it", () => {
    // The caller falls back to a centre crop, which is what would have
    // happened anyway.
    expect(parseMediaFit("somewhere nice")).toBeNull();
  });
});

describe("parseMediaFit refuses to pass anything through", () => {
  /**
   * Every one of these would be a CSS injection if the value were used as
   * written. The parser rebuilds the string from a whitelist rather than
   * sanitising, so the only way out is via a keyword or a validated number.
   */
  const HOSTILE = [
    "red; background: url(https://evil.example/pixel.png)",
    "50% 50%; position: fixed; top: 0",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "var(--secret)",
    "top/**/;color:red",
    "calc(100% - 10px)",
    "-9999px",
    "</style><script>alert(1)</script>",
    "attr(href)",
  ];

  for (const value of HOSTILE) {
    it(`neutralises ${JSON.stringify(value.slice(0, 34))}`, () => {
      const result = parseMediaFit(value);
      if (result === null) return;

      // Whatever survived has to be two plain percentages and a known keyword.
      expect(result.position).toMatch(/^\d+(\.\d+)?% \d+(\.\d+)?%$/);
      expect(["cover", "contain"]).toContain(result.fit);
    });
  }

  it("drops percentages outside 0-100", () => {
    expect(parseMediaFit("500%")).toBeNull();
    expect(parseMediaFit("-20")).toBeNull();
  });

  it("keeps the good half of a part-hostile value", () => {
    // A stray word should not cost the reader the picture, so the recognised
    // part is used and the rest is discarded rather than failing the row.
    expect(parseMediaFit("top; color: red")).toEqual({
      fit: "cover",
      position: "50% 0%",
    });
  });
});
