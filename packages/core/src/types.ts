/**
 * What a timeline event actually is.
 *
 * Deliberately small. A sheet column that is empty in every row is not a
 * feature, it is a field the code branches on and never reaches — so this is
 * only what a timeline genuinely needs, and everything else rides along in
 * `extra` for whoever wants it.
 */
export type TimelineEvent = {
  id: string;

  /** Start of the span, in fractional years. 1969.5 is mid-1969. */
  from: number;
  /** End of the span. Equal to `from` for a moment rather than a period. */
  to: number;

  /** True when the span was inferred from prose rather than read as a number. */
  approximate: boolean;

  /** Exactly what the source says, and what the reader is shown. */
  displayDate: string;

  headline: string;
  text: string;

  media?: string;
  mediaCredit?: string;
  mediaCaption?: string;

  /** Any column the schema does not name, keyed by its header. */
  extra?: Record<string, string>;
};

/** How a media URL should be presented. Derived from the host, not a column. */
export type MediaKind =
  | "youtube"
  | "vimeo"
  | "flickr"
  | "twitter"
  | "bluesky"
  | "mastodon"
  | "soundcloud"
  | "bandcamp"
  | "archive"
  | "wikipedia"
  | "image"
  /** Nothing showable in place — an article, a paper, a map. */
  | "link";

/**
 * How dates are read.
 *
 * The defaults suit a history: nothing has happened yet in 2200, so a century
 * that runs past the present is cut off at it. A roadmap is the opposite case
 * and sets `maxYear: Infinity`.
 */
export type ParseOptions = {
  /**
   * The latest year any span may reach. Defaults to the current year, which
   * keeps a history from reserving half its width for empty future. Pass
   * `Infinity` for timelines that are supposed to run forward.
   */
  maxYear?: number;
  /** The earliest year any span may reach. Defaults to `-Infinity`. */
  minYear?: number;
  /** What "present" resolves to. Defaults to the current year. */
  now?: number;
};

/**
 * How the axis is built.
 *
 * Every one of these has a sensible value derived from the data's own range,
 * so a timeline of one conference day and a timeline of the Pleistocene both
 * work without being configured. They are here because the derivation is a
 * guess, and a guess should be overridable.
 */
export type ScaleOptions = {
  /**
   * Years of quiet kept either side of an event before a gap may be collapsed.
   * Defaults to 2% of the data's range.
   */
  breathingRoom?: number;
  /**
   * The shortest gap worth collapsing. A quiet stretch reads as a pause, and
   * removing a short one would misrepresent how far apart two events were.
   * Defaults to 8% of the data's range.
   */
  minGap?: number;
  /** What a collapsed gap costs, in units. Constant, whatever it spans. */
  gapUnits?: number;
  /** Hard ceiling on the axis. Defaults to `ParseOptions.maxYear`. */
  maxYear?: number;
  /** Set false to draw the true distances and never collapse anything. */
  collapseGaps?: boolean;
};
