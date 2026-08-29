import { eventsFromCsv, eventsFromObjects } from "./parse";
import type { ParseOptions, TimelineEvent } from "./types";

/**
 * Where a timeline's data comes from.
 *
 * A loader is a function that produces events. That is the whole contract, and
 * it exists so that Google is one option rather than a dependency: their CSV
 * endpoint rate-limits, occasionally stalls, and could be changed at any time
 * by people who have never heard of this project. A timeline that can also read
 * a JSON file, a local CSV, or an array already in memory survives that.
 */
export type Loader = () => Promise<TimelineEvent[]>;

/**
 * Turns a published-sheet URL of any shape into its CSV export.
 *
 * Via the CSV endpoint, not the `pubhtml` page. That page is a JavaScript shell
 * — fetching it returns a script bundle with no `<table>` in it at all — so
 * anything scraping the HTML gets nothing back. The CSV endpoint is the same
 * publish, in a format that is actually parseable.
 */
export function toCsvUrl(sourceUrl: string): string {
  if (sourceUrl.includes("output=csv")) return sourceUrl;

  const base = sourceUrl
    .split("?")[0]
    .replace(/\/pubhtml$/, "")
    .replace(/\/edit$/, "")
    .replace(/\/view$/, "")
    .replace(/\/$/, "");

  const gid = sourceUrl.match(/[?&]gid=(\d+)/)?.[1];

  // An /edit or /d/<id> URL that was never published needs the export path;
  // a /d/e/<id> one is already a publish and takes /pub.
  if (!/\/d\/e\//.test(base)) {
    const key = base.match(/\/d\/([\w-]{20,})/)?.[1];
    if (key) {
      return `https://docs.google.com/spreadsheets/d/${key}/export?format=csv${
        gid ? `&gid=${gid}` : ""
      }`;
    }
  }

  return `${base}/pub?output=csv${gid ? `&gid=${gid}&single=true` : ""}`;
}

/**
 * A short-lived cache, in the tab that asked.
 *
 * Without it every page load hits Google for a file that changes a few times a
 * year, which is slow for the reader and is how a popular embed gets an origin
 * rate-limited. Session storage rather than local: a stale timeline should
 * never outlive the visit that cached it.
 *
 * Reached through `globalThis` rather than named directly, because this package
 * is meant to run in Node as well as a browser and `sessionStorage` is the one
 * genuinely browser-only thing in it. Feature-detected here, replaceable via
 * `setCacheStore`, and absent without complaint on a server.
 */
export type CacheStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const CACHE_PREFIX = "besttime:v1:";

type Cached = { at: number; text: string };

let store: CacheStore | null | undefined;

/** Swaps the cache out — for a test, or for a server-side store. */
export function setCacheStore(next: CacheStore | null): void {
  store = next;
}

function cacheStore(): CacheStore | null {
  if (store !== undefined) return store;

  const candidate = (globalThis as { sessionStorage?: CacheStore })
    .sessionStorage;
  // Touch it once: Safari with cookies blocked has the property but throws on
  // access, and finding that out during a load loses the load.
  try {
    candidate?.getItem(`${CACHE_PREFIX}probe`);
    store = candidate ?? null;
  } catch {
    store = null;
  }
  return store;
}

function readCache(key: string, ttlMs: number): string | null {
  const backing = ttlMs > 0 ? cacheStore() : null;
  if (!backing) return null;

  try {
    const raw = backing.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Cached;
    if (Date.now() - entry.at > ttlMs) {
      backing.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.text;
  } catch {
    // A private window, a blocked store, or something that is not our JSON.
    return null;
  }
}

function writeCache(key: string, text: string): void {
  const backing = cacheStore();
  if (!backing) return;

  try {
    const entry: Cached = { at: Date.now(), text };
    backing.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Over quota, or storage is off. Not being able to remember is not a
    // reason to fail the load.
  }
}

export type FetchOptions = ParseOptions & {
  /** How long a cached copy stays good. Defaults to five minutes; 0 disables. */
  cacheMs?: number;
  /** Passed through to `fetch`, for aborting and for custom headers. */
  signal?: AbortSignal;
};

async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const ttl = options.cacheMs ?? 5 * 60 * 1000;

  const cached = readCache(url, ttl);
  if (cached !== null) return cached;

  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(
      `The timeline source returned ${response.status}. If this is a Google Sheet, check that it is published to the web via File → Share → Publish to web.`,
    );
  }

  const text = await response.text();
  if (ttl > 0) writeCache(url, text);
  return text;
}

/** Events from a published Google Sheet, or anything else serving CSV. */
export function fromSheet(sourceUrl: string, options: FetchOptions = {}): Loader {
  return async () => eventsFromCsv(await fetchText(toCsvUrl(sourceUrl), options), options);
}

/** Events from a CSV file served from anywhere, with no URL rewriting. */
export function fromCsvUrl(url: string, options: FetchOptions = {}): Loader {
  return async () => eventsFromCsv(await fetchText(url, options), options);
}

/** Events from CSV text already in hand. */
export function fromCsv(text: string, options: ParseOptions = {}): Loader {
  return async () => eventsFromCsv(text, options);
}

/**
 * Events from a JSON file.
 *
 * Either a bare array, or an object with an `events` array, because both are
 * what people actually write.
 */
export function fromJson(url: string, options: FetchOptions = {}): Loader {
  return async () => {
    const text = await fetchText(url, options);
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : (parsed?.events ?? []);
    return eventsFromObjects(list, options);
  };
}

/** Events from objects already in memory. */
export function fromData(
  input: Array<Record<string, unknown>>,
  options: ParseOptions = {},
): Loader {
  return async () => eventsFromObjects(input, options);
}

/**
 * Picks a loader from a URL, by looking at it.
 *
 * So that `<best-time src="...">` does the obvious thing whether it is pointed
 * at a sheet, a JSON file or a CSV, and nobody has to read a page about loaders
 * to put a timeline on a page.
 */
export function loaderFor(src: string, options: FetchOptions = {}): Loader {
  if (/docs\.google\.com/.test(src)) return fromSheet(src, options);
  if (/\.json(\?|$)/i.test(src)) return fromJson(src, options);
  if (/\.(csv|tsv)(\?|$)/i.test(src)) return fromCsvUrl(src, options);
  // Anything else is tried as a sheet, since that is the common case and
  // `toCsvUrl` leaves a URL it does not recognise alone.
  return fromSheet(src, options);
}
