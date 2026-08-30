import { describe, expect, it } from "vitest";

import { eventsFromCsv, eventsFromObjects } from "../src/parse";
import { fromFractionalYear } from "../src/prose";
import { toCsvUrl } from "../src/loaders";
import { canEmbed, mediaKind, registerMedia } from "../src/media";

const options = { now: 2026, maxYear: 2026 };

const BESTTIME_SHEET = `Date,Display Date,Headline,Text,Media,Media Credit,Media Caption
1969-07-20,"July 20, 1969",Apollo 11,"Armstrong steps out.",https://youtube.com/watch?v=abc123def,NASA,The first step
,1970s-present,Deep time,"A period, not a moment.",,,
-700,c. 700 BCE,Early writing,"Something old.",https://en.wikipedia.org/wiki/Writing,,`;

/** KnightLab's nineteen columns, most of them empty, as they arrive. */
const TIMELINEJS_SHEET = `Year,Month,Day,Time,End Year,End Month,End Day,End Time,Display Date,Headline,Text,Media,Media Credit,Media Caption,Media Thumbnail,Type,Group,Background,Tag
1969,,,,,,,,July 1969,Apollo 11,"Armstrong steps out.",,,,,,,,
1914,,,,1918,,,,1914-1918,The war,"Four years.",,,,,,,,`;

describe("eventsFromCsv", () => {
  it("reads BestTime's own schema", () => {
    const events = eventsFromCsv(BESTTIME_SHEET, options);
    expect(events).toHaveLength(3);
    expect(events[0].headline).toBe("Apollo 11");
    expect(events[0].mediaCredit).toBe("NASA");
  });

  it("reads a TimelineJS sheet unchanged", () => {
    // Thousands of these already exist. Asking their owners to retype them is
    // a bad trade, and supporting them is most of an adoption strategy.
    const events = eventsFromCsv(TIMELINEJS_SHEET, options);
    expect(events).toHaveLength(2);
    expect(events[0].headline).toBe("Apollo 11");
  });

  it("uses the End column when TimelineJS supplies one", () => {
    const events = eventsFromCsv(TIMELINEJS_SHEET, options);
    expect(events[1]).toMatchObject({ from: 1914, to: 1918 });
  });

  it("reads TimelineJS's split Year/Month/Day columns", () => {
    // Without this an event dated 20 July 1969 lands on the first of January:
    // invisible on a century-scale timeline, and badly wrong on a short one.
    const events = eventsFromCsv(
      `Year,Month,Day,Headline\n1969,7,20,Apollo 11`,
      options,
    );
    const { month, day } = fromFractionalYear(events[0].from);
    expect([month, day]).toEqual([7, 20]);
    // A moment, so the end travels with the start rather than staying pinned.
    expect(events[0].to).toBe(events[0].from);
  });

  it("reads a split end date too", () => {
    const events = eventsFromCsv(
      `Year,Month,Day,End Year,End Month,End Day,Headline\n1914,7,28,1918,11,11,The war`,
      options,
    );
    expect(fromFractionalYear(events[0].from)).toMatchObject({ month: 7, day: 28 });
    expect(fromFractionalYear(events[0].to)).toMatchObject({ month: 11, day: 11 });
  });

  it("treats a month with no day as the first of it", () => {
    const events = eventsFromCsv(`Year,Month,Headline\n1969,7,Apollo 11`, options);
    expect(fromFractionalYear(events[0].from)).toMatchObject({ month: 7, day: 1 });
  });

  it("ignores a month against a span read from prose", () => {
    // "The 1970s" is a decade. Applying a month to it would fabricate a
    // precision the row never had.
    const events = eventsFromCsv(
      `Year,Month,Display Date,Headline\n,7,1970s,Deep time`,
      options,
    );
    expect(events[0]).toMatchObject({ from: 1970, to: 1979, approximate: true });
  });

  it("ignores nonsense in the month and day columns", () => {
    const events = eventsFromCsv(
      `Year,Month,Day,Headline\n1969,13,99,Apollo 11\n1970,n/a,,Something`,
      options,
    );
    expect(events[0].from).toBe(1969);
    expect(events[1].from).toBe(1970);
  });

  it("keeps a prose-only row as a span", () => {
    const events = eventsFromCsv(BESTTIME_SHEET, options);
    const deep = events.find((event) => event.headline === "Deep time")!;
    expect(deep.approximate).toBe(true);
    expect(deep.to).toBeGreaterThan(deep.from);
  });

  it("marks a dated row exact", () => {
    expect(eventsFromCsv(BESTTIME_SHEET, options)[0].approximate).toBe(false);
  });

  it("orders from and to, whichever way round they were written", () => {
    const events = eventsFromCsv(
      "Date,End,Headline\n2000,1990,Backwards",
      options,
    );
    expect(events[0].from).toBeLessThanOrEqual(events[0].to);
  });

  it("skips a row with neither headline nor text", () => {
    const events = eventsFromCsv(
      "Date,Headline,Text\n1969,Moon,Stepped out\n1970,,\n",
      options,
    );
    expect(events).toHaveLength(1);
  });

  it("accepts loose header spellings", () => {
    const events = eventsFromCsv(
      "start_date,title,description\n1969,Moon,Stepped out",
      options,
    );
    expect(events[0].headline).toBe("Moon");
    expect(events[0].text).toBe("Stepped out");
  });

  it("carries unrecognised columns along in extra", () => {
    const events = eventsFromCsv(
      "Date,Headline,Region\n1969,Moon,Sea of Tranquility",
      options,
    );
    expect(events[0].extra).toEqual({ region: "Sea of Tranquility" });
  });

  it("returns nothing for a sheet with only headers", () => {
    expect(eventsFromCsv("Date,Headline", options)).toEqual([]);
  });

  it("returns nothing rather than throwing on nonsense", () => {
    expect(eventsFromCsv("", options)).toEqual([]);
    expect(eventsFromCsv("just one line of prose", options)).toEqual([]);
  });
});

describe("eventsFromObjects", () => {
  it("reads the same field names as the sheet columns", () => {
    const events = eventsFromObjects(
      [{ date: 1969, headline: "Moon", text: "Stepped out" }],
      options,
    );
    expect(events[0]).toMatchObject({ from: 1969, headline: "Moon" });
  });

  it("tolerates rows with different keys", () => {
    const events = eventsFromObjects(
      [
        { date: 1969, headline: "Moon" },
        { date: 1972, headline: "Last", media: "https://example.com/a.jpg" },
      ],
      options,
    );
    expect(events).toHaveLength(2);
    expect(events[1].media).toBe("https://example.com/a.jpg");
  });
});

describe("toCsvUrl", () => {
  it("rewrites a published pubhtml URL", () => {
    expect(toCsvUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pubhtml"))
      .toBe("https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pub?output=csv");
  });

  it("keeps the sheet tab when one is named", () => {
    expect(
      toCsvUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pubhtml?gid=42"),
    ).toContain("gid=42");
  });

  it("rewrites an /edit URL to the export endpoint", () => {
    expect(
      toCsvUrl(
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234567890/edit",
      ),
    ).toContain("/export?format=csv");
  });

  it("leaves a URL that is already CSV alone", () => {
    const url = "https://example.com/data.csv?output=csv";
    expect(toCsvUrl(url)).toBe(url);
  });
});

describe("media", () => {
  it("recognises the hosts it can show", () => {
    expect(mediaKind("https://youtube.com/watch?v=abc123")).toBe("youtube");
    expect(mediaKind("https://en.wikipedia.org/wiki/Moon")).toBe("wikipedia");
    expect(mediaKind("https://upload.wikimedia.org/foo/bar")).toBe("image");
    expect(mediaKind("https://bsky.app/profile/a.bsky.social/post/xyz")).toBe(
      "bluesky",
    );
  });

  it("treats an article as a link, not a picture", () => {
    expect(mediaKind("https://plato.stanford.edu/entries/memory/")).toBe("link");
    expect(canEmbed("https://plato.stanford.edu/entries/memory/")).toBe(false);
  });

  it("recognises an image with no extension on a known host", () => {
    // Wikimedia thumbnails and CDN-signed links carry no .jpg, and without a
    // host list every one of them is thrown away.
    expect(mediaKind("https://i.imgur.com/aBcDeF")).toBe("image");
  });

  it("does not fall over on a value that is not a URL", () => {
    expect(mediaKind("see the attached scan")).toBe("link");
    expect(canEmbed("")).toBe(false);
  });

  it("reads a framing instruction from the sheet", () => {
    const events = eventsFromCsv(
      "Date,Headline,Media,Media Fit\n1969,Moon,https://example.com/a.jpg,top",
      options,
    );
    expect(events[0].mediaFit).toBe("top");
  });

  it("lets a framing column be spelled several ways", () => {
    for (const header of ["Media Fit", "Crop", "Focus", "media_fit"]) {
      const events = eventsFromCsv(
        `Date,Headline,${header}\n1969,Moon,bottom`,
        options,
      );
      expect(events[0].mediaFit).toBe("bottom");
    }
  });

  it("lets a registered adapter take over a host", () => {
    // The contribution surface. Adding a host should cost fifteen lines in a
    // file of its own, not a patch to the middle of a component.
    registerMedia({
      name: "test-host",
      kind: "image",
      test: (_url, hostname) => hostname === "pictures.example.com",
      image: (url) => url,
    });

    expect(mediaKind("https://pictures.example.com/anything")).toBe("image");
    expect(canEmbed("https://pictures.example.com/anything")).toBe(true);
  });
});
