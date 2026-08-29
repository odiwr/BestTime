import { describe, expect, it } from "vitest";

import { parseCsv } from "../src/csv";

describe("parseCsv", () => {
  it("reads a plain sheet", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted cells", () => {
    const rows = parseCsv('headline,text\nMoon,"One small step, and so on"');
    expect(rows[1]).toEqual(["Moon", "One small step, and so on"]);
  });

  it("keeps newlines inside quoted cells", () => {
    // The reason this parser exists: a description column runs to paragraphs,
    // and splitting on newlines silently loses every row after the first one
    // that contains a hard break.
    const rows = parseCsv('a,b\n"one\ntwo",three');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("one\ntwo");
  });

  it("unescapes a doubled quote", () => {
    const rows = parseCsv('a\n"He said ""no"" twice"');
    expect(rows[1][0]).toBe('He said "no" twice');
  });

  it("survives CRLF", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops a byte-order mark rather than gluing it to the first header", () => {
    // Excel writes one. Without this the first column is named "﻿Year"
    // and every lookup for "year" misses it.
    const rows = parseCsv("﻿Year,Headline\n1969,Moon");
    expect(rows[0][0]).toBe("Year");
  });

  it("discards blank trailing rows", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toHaveLength(2);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
