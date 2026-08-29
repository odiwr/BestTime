import type { ParseOptions } from "./types";

/**
 * Turning what a source *says* into a span on an axis.
 *
 * Most timeline data is not dates. A quarter of the rows in a typical sheet
 * have no year column at all, and what they say instead is genuinely a period
 * rather than a moment — "1970s-present", "21st century", "late Bronze Age".
 * Reading those as spans puts them on the axis honestly, as a bar covering what
 * the source claims. Picking a single year for them would invent a precision
 * nobody wrote down.
 *
 * Everything here works in fractional years, so a day is a real position and
 * not a rounding. 1969.5417 is the middle of July 1969.
 */

export type Span = { from: number; to: number; approximate: boolean };

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Days before the first of each month in a non-leap year. */
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

const isLeap = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** A calendar date as a fractional year. */
export function toFractionalYear(
  year: number,
  month = 1,
  day = 1,
): number {
  const days = isLeap(year) ? 366 : 365;
  const leapShift = isLeap(year) && month > 2 ? 1 : 0;
  const dayOfYear = MONTH_STARTS[Math.min(11, Math.max(0, month - 1))] + leapShift + (day - 1);
  return year + dayOfYear / days;
}

/** The inverse, for labelling a position. */
export function fromFractionalYear(value: number): {
  year: number;
  month: number;
  day: number;
} {
  const year = Math.floor(value + 1e-9);
  const days = isLeap(year) ? 366 : 365;
  // Rounded, not floored: the arithmetic that got here is lossy at the
  // fifteenth decimal place and a floor turns the 1st into the 31st.
  const dayOfYear = Math.round((value - year) * days);

  let month = 11;
  for (let i = 0; i < 12; i += 1) {
    const leapShift = isLeap(year) && i > 1 ? 1 : 0;
    if (dayOfYear < MONTH_STARTS[i] + leapShift) {
      month = i - 1;
      break;
    }
  }
  month = Math.max(0, month);
  const leapShift = isLeap(year) && month > 1 ? 1 : 0;

  return {
    year,
    month: month + 1,
    day: dayOfYear - MONTH_STARTS[month] - leapShift + 1,
  };
}

const monthFromName = (name: string): number | null => {
  const lower = name.toLowerCase();
  const index = MONTH_NAMES.findIndex((month) => month.startsWith(lower.slice(0, 3)));
  return index === -1 ? null : index + 1;
};

/**
 * A calendar date, in whichever of the common shapes it was written.
 *
 * ISO first, because it is the only one that is never ambiguous. The written
 * forms after it, month name and all, because that is what a person types into
 * a spreadsheet cell when nobody has told them not to.
 */
function readCalendarDate(text: string): Span | null {
  // 2020-03-15, 2020/03/15, and the year-month forms of both.
  const iso = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = iso[3] ? Number(iso[3]) : null;

    if (month < 1 || month > 12) return null;

    // A month with no day is the whole month, not its first morning.
    if (day === null) {
      return {
        from: toFractionalYear(year, month, 1),
        to: toFractionalYear(year, month + 1 > 12 ? 12 : month + 1, 1) - 1e-4,
        approximate: false,
      };
    }
    const at = toFractionalYear(year, month, day);
    return { from: at, to: at, approximate: false };
  }

  // "15 March 2020", "March 15, 2020", "Mar 2020".
  const named = text.match(
    /^(?:(\d{1,2})\s+)?([a-z]{3,9})\.?\s+(?:(\d{1,2}),?\s+)?(\d{3,4})$/,
  );
  if (named) {
    const month = monthFromName(named[2]);
    if (month === null) return null;

    const day = named[1] ? Number(named[1]) : named[3] ? Number(named[3]) : null;
    const year = Number(named[4]);

    if (day === null) {
      return {
        from: toFractionalYear(year, month, 1),
        to: toFractionalYear(year, month + 1 > 12 ? 12 : month + 1, 1) - 1e-4,
        approximate: false,
      };
    }
    const at = toFractionalYear(year, month, day);
    return { from: at, to: at, approximate: false };
  }

  return null;
}

/**
 * Reads a period out of prose.
 *
 * Order matters: the most specific shape that can match, wins. A bare year is
 * the last resort, because "1970s" and "1519-1544" both contain one.
 */
function readProseRaw(raw: string, now: number): Span | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  const calendar = readCalendarDate(text);
  if (calendar) return calendar;

  // "BCE" contains "CE", so the test has to remove it before looking.
  const bce = /bce?|b\.c\./.test(text) && !/ce/.test(text.replace(/bce/g, ""));
  const sign = bce ? -1 : 1;
  const endsNow = /present|today|now|ongoing|current/.test(text);

  // "1970s", optionally running to the present.
  const decade = text.match(/(\d{4})s\b/);
  if (decade) {
    const start = Number(decade[1]);
    return { from: start, to: endsNow ? now : start + 9, approximate: true };
  }

  // "1519-1544", "1519–1544". Also "March 2020 - June 2021" via each half.
  const range = text.match(/(\d{3,4})\s*(?:[-–—]|to)\s*(\d{3,4})/);
  if (range) {
    return {
      from: sign * Number(range[1]),
      to: sign * Number(range[2]),
      approximate: true,
    };
  }

  // "21st century", "late 20th-21st c." A phrase naming two centuries runs
  // from the first to the second, so both ordinals are collected rather than
  // only the one sitting next to the word.
  const ordinals = [...text.matchAll(/(\d{1,2})\s*(?:st|nd|rd|th)/g)].map(
    (match) => Number(match[1]),
  );
  if (/centur|\bc\b|c\./.test(text) && ordinals.length > 0) {
    const first = Math.min(...ordinals);
    const last = Math.max(...ordinals);

    const start = bce ? -(first * 100) : (first - 1) * 100 + 1;
    const end = bce ? -((last - 1) * 100 + 1) : last * 100;

    // "Early", "mid" and "late" each name a third of the span.
    const third = Math.round((end - start) / 3);
    const from = /late/.test(text)
      ? end - third
      : /mid/.test(text)
        ? start + third
        : start;
    const to = /early/.test(text)
      ? start + third
      : /mid/.test(text)
        ? end - third
        : end;

    return { from, to, approximate: true };
  }

  // A bare year, with or without an era.
  const year = text.match(/(-?\d{1,4})/);
  if (year) {
    const value = sign * Math.abs(Number(year[1]));
    return { from: value, to: endsNow ? now : value, approximate: true };
  }

  // Prose with no number in it at all.
  if (/modern|contemporary/.test(text)) {
    return { from: 1950, to: now, approximate: true };
  }
  if (endsNow) return { from: now, to: now, approximate: true };

  return null;
}

/** As above, then held inside whatever bounds the caller set. */
export function readProse(raw: string, options: ParseOptions = {}): Span | null {
  const now = options.now ?? new Date().getFullYear();
  const max = options.maxYear ?? now;
  const min = options.minYear ?? -Infinity;

  const span = readProseRaw(raw, now);
  if (!span) return null;

  return {
    from: Math.min(Math.max(span.from, min), max),
    to: Math.min(Math.max(span.to, min), max),
    approximate: span.approximate,
  };
}

/**
 * Where an event sits.
 *
 * A dedicated date column wins when it holds something readable: it is the one
 * field entered as data rather than as description. Prose is the fallback, and
 * marks the span approximate so the axis can draw it as the estimate it is.
 */
export function readSpan(
  dateColumn: string,
  displayDate: string,
  options: ParseOptions = {},
): Span | null {
  const raw = dateColumn.trim();

  if (raw) {
    // A plain number is a year, including a negative one for BCE.
    const value = Number(raw);
    if (Number.isFinite(value) && /^-?\d+(\.\d+)?$/.test(raw)) {
      const year = Math.trunc(value);
      const now = options.now ?? new Date().getFullYear();
      const max = options.maxYear ?? now;
      const min = options.minYear ?? -Infinity;
      const held = Math.min(Math.max(year, min), max);
      return { from: held, to: held, approximate: false };
    }

    // Otherwise it may still be a date rather than a year — a column headed
    // "Year" routinely holds "2020-03-15" once somebody has a real date.
    const parsed = readProse(raw, options);
    if (parsed) return { ...parsed, approximate: false };
  }

  return readProse(displayDate, options);
}
