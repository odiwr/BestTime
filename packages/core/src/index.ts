/**
 * BestTime core — the engine, with no opinion about how it is drawn.
 *
 * Nothing in this package touches the DOM, imports a framework, or knows what a
 * pixel looks like. It reads sources into events, and it does the arithmetic
 * that turns events into positions on a compressed axis. Everything visual is
 * built on top of it.
 *
 * Which means it runs in Node as happily as in a browser: generating a static
 * timeline at build time, validating a contributor's sheet in CI, or testing
 * the axis maths are all the same package.
 */

export type {
  TimelineEvent,
  MediaKind,
  ParseOptions,
  ScaleOptions,
} from "./types";

export { parseCsv } from "./csv";

export {
  readProse,
  readSpan,
  toFractionalYear,
  fromFractionalYear,
  type Span,
} from "./prose";

export { rowsToEvents, eventsFromCsv, eventsFromObjects } from "./parse";

export {
  toCsvUrl,
  fromSheet,
  fromCsv,
  fromCsvUrl,
  fromJson,
  fromData,
  loaderFor,
  setCacheStore,
  type Loader,
  type FetchOptions,
  type CacheStore,
} from "./loaders";

export {
  buildScale,
  yearToUnit,
  unitToYear,
  ticksFor,
  zoomAbout,
  packLanes,
  formatYear,
  fitZoom,
  clampZoom,
  maxZoomFor,
  LADDER,
  MIN_PX_PER_UNIT,
  ZOOM_STEP,
  type Scale,
  type Segment,
  type Tick,
} from "./scale";

export {
  registerMedia,
  mediaAdapters,
  adapterFor,
  mediaKind,
  canEmbed,
  hostLabel,
  resolveMedia,
  parseMediaFit,
  DEFAULT_FIT,
  type MediaFit,
  type MediaAdapter,
  type ResolvedMedia,
} from "./media";
