import { parseCsv } from "./csv";
import { readSpan, toFractionalYear } from "./prose";
import type { ParseOptions, TimelineEvent } from "./types";

/**
 * Turning rows into events.
 *
 * Two column schemas are understood. BestTime's own is the seven fields a
 * timeline actually uses. KnightLab's TimelineJS schema is the other, because
 * thousands of those sheets already exist and asking their owners to retype
 * them is a bad trade for everyone — its nineteen columns are read where they
 * hold something and ignored where they do not.
 *
 * Header matching is loose on purpose: `Display Date`, `display_date` and
 * `displaydate` are the same column, and a spreadsheet maintained by hand will
 * eventually contain all three.
 */

/** Every header a field answers to, in order of preference. */
const FIELDS = {
  date: ["date", "year", "start", "start date", "startdate", "when"],
  displayDate: ["display date", "displaydate", "label", "date label"],
  headline: ["headline", "title", "name", "event"],
  text: ["text", "description", "body", "summary", "details"],
  media: ["media", "url", "link", "image", "source url"],
  mediaCredit: ["media credit", "mediacredit", "credit", "author"],
  mediaCaption: ["media caption", "mediacaption", "caption", "alt"],
  /**
   * Framing, so an author can stop a portrait being cropped through the face
   * without leaving the spreadsheet they are already in.
   */
  mediaFit: ["media fit", "mediafit", "fit", "crop", "media crop", "focus"],
  /** TimelineJS's end-of-span columns, folded in where present. */
  end: ["end", "end date", "enddate", "end year", "endyear"],
  /**
   * TimelineJS splits a date across three columns. Without these, an event
   * dated 20 July 1969 lands on the first of January — invisible on a
   * century-scale timeline and badly wrong on a short one.
   */
  month: ["month", "start month", "startmonth"],
  day: ["day", "start day", "startday"],
  endMonth: ["end month", "endmonth"],
  endDay: ["end day", "endday"],
} as const;

type Field = keyof typeof FIELDS;

const normalise = (header: string) =>
  header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

/**
 * A reader for one row, given the sheet's headers.
 *
 * Resolved once for the whole sheet rather than per row: a lookup per field per
 * row over a few thousand rows is the difference between instant and visibly
 * slow, and the headers do not change halfway down.
 */
function columnMap(headers: string[]): Record<Field, number> {
  const cleaned = headers.map(normalise);
  const map = {} as Record<Field, number>;

  for (const [field, names] of Object.entries(FIELDS) as Array<
    [Field, readonly string[]]
  >) {
    map[field] = -1;
    for (const name of names) {
      const index = cleaned.indexOf(name);
      if (index !== -1) {
        map[field] = index;
        break;
      }
    }
  }

  return map;
}

/** Column indexes no field claimed, so their values can ride along in `extra`. */
function spareColumns(headers: string[], map: Record<Field, number>): number[] {
  const claimed = new Set(Object.values(map));
  return headers.map((_, index) => index).filter((index) => !claimed.has(index));
}

export function rowsToEvents(
  rows: string[][],
  options: ParseOptions = {},
): TimelineEvent[] {
  if (rows.length < 2) return [];

  const headers = rows[0];
  const map = columnMap(headers);
  const spare = spareColumns(headers, map);

  const cell = (row: string[], field: Field) => {
    const index = map[field];
    return index === -1 ? "" : (row[index] ?? "").trim();
  };

  const events: TimelineEvent[] = [];

  rows.slice(1).forEach((row, index) => {
    const headline = cell(row, "headline");
    const text = cell(row, "text");

    // A row with neither a headline nor a body is a spacer, a note to self, or
    // the blank line somebody left under the last entry.
    if (!headline && !text) return;

    const displayDate = cell(row, "displayDate");
    const span = readSpan(cell(row, "date"), displayDate, options);
    if (!span) return;

    let { from, to, approximate } = span;

    // TimelineJS keeps the end of a period in its own column. Where it holds
    // something, it is more trustworthy than a range guessed out of prose.
    const end = cell(row, "end");
    if (end) {
      const endSpan = readSpan(end, end, options);
      if (endSpan) {
        to = endSpan.to;
        approximate = span.approximate && endSpan.approximate;
      }
    }

    // Then the split columns, which refine a whole year into a real date.
    // Only when the year came from the date column as an exact whole number:
    // a month is meaningless against a span already read as "the 1970s", and
    // applying one there would fabricate a precision the row never had.
    const refine = (year: number, monthCell: Field, dayCell: Field) => {
      if (!Number.isInteger(year)) return year;

      const month = Number(cell(row, monthCell));
      if (!Number.isInteger(month) || month < 1 || month > 12) return year;

      const rawDay = Number(cell(row, dayCell));
      const day = Number.isInteger(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : 1;
      return toFractionalYear(year, month, day);
    };

    if (!span.approximate) {
      const refined = refine(from, "month", "day");
      // A dated row with no end column is a moment, so the end travels with
      // the start rather than staying pinned to the first of January.
      if (refined !== from) {
        if (to === from) to = refined;
        from = refined;
      }
    }
    if (end) to = refine(to, "endMonth", "endDay");

    const extra: Record<string, string> = {};
    for (const column of spare) {
      const value = (row[column] ?? "").trim();
      if (value) extra[normalise(headers[column])] = value;
    }

    const media = cell(row, "media");

    events.push({
      id: `event-${index}`,
      from: Math.min(from, to),
      to: Math.max(from, to),
      approximate,
      // A row with a date but no words for it still has to say something.
      displayDate: displayDate || String(Math.round(from)),
      headline: headline || displayDate || "Untitled",
      text,
      media: media || undefined,
      mediaCredit: cell(row, "mediaCredit") || undefined,
      mediaCaption: cell(row, "mediaCaption") || undefined,
      mediaFit: cell(row, "mediaFit") || undefined,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    });
  });

  return events;
}

/** Events from a CSV string, whatever produced it. */
export function eventsFromCsv(
  text: string,
  options: ParseOptions = {},
): TimelineEvent[] {
  return rowsToEvents(parseCsv(text), options);
}

/**
 * Events from loose objects — a JSON file, an API, a `<script>` block.
 *
 * The same field names as the sheet columns, so a person moving from one to the
 * other does not have to learn a second vocabulary.
 */
export function eventsFromObjects(
  input: Array<Record<string, unknown>>,
  options: ParseOptions = {},
): TimelineEvent[] {
  const keys = new Set<string>();
  for (const entry of input) for (const key of Object.keys(entry)) keys.add(key);

  const headers = [...keys];
  const rows = [
    headers,
    ...input.map((entry) =>
      headers.map((key) => {
        const value = entry[key];
        return value === undefined || value === null ? "" : String(value);
      }),
    ),
  ];

  return rowsToEvents(rows, options);
}
