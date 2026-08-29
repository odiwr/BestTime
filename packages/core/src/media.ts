import type { MediaKind } from "./types";

/**
 * How a link becomes something you can look at.
 *
 * Most timeline sources have no media-type column — and where they do, it is
 * empty in every row — so the kind is read from the host. Of the links in a
 * typical sheet, only some fraction point at something showable in place: a
 * video, a photo, a tweet, an article whose lead image can be fetched. The rest
 * are journal articles, encyclopaedia entries and news stories. A page, not a
 * picture.
 *
 * This is a registry rather than a switch statement on purpose. Adding support
 * for a new host is the most common thing anyone will want to contribute, and
 * it should cost fifteen lines in a file of its own rather than a patch to the
 * middle of a component.
 */
export type MediaAdapter = {
  /** Identifies the adapter in errors and in the registry. */
  name: string;
  kind: MediaKind;

  /**
   * Whether this adapter claims the URL. Given both the raw string and the
   * parsed hostname, because some hosts are recognised by domain and some by
   * the shape of the path.
   */
  test: (url: string, hostname: string) => boolean;

  /** The iframe this URL embeds through, if it embeds through one. */
  frame?: (url: string) => string | null;

  /**
   * A picture for this URL, if it resolves to one. May be async — Wikipedia
   * will hand over an article's lead image for the asking, and a portrait is
   * worth more than a link to the page about the person.
   */
  image?: (url: string) => string | null | Promise<string | null>;
};

const id = (url: string, pattern: RegExp) => url.match(pattern)?.[1] ?? null;

/**
 * Hosts that serve pictures rather than pages.
 *
 * An extension is not enough on its own: plenty of image URLs — Wikimedia
 * thumbnails, CDN-signed links — carry no `.jpg` at the end, and without this
 * they are all thrown away. Anything matching here is *tried* as an image and
 * falls back if it does not turn out to be one, so a wrong guess costs a failed
 * request rather than a broken pane.
 */
const IMAGE_HOSTS =
  /^(?:upload\.wikimedia\.org|i\.imgur\.com|images\.unsplash\.com|pbs\.twimg\.com|live\.staticflickr\.com|farm\d+\.staticflickr\.com|substackcdn\.com|images\.squarespace-cdn\.com|cdn\.britannica\.com|media\.newyorker\.com|.*\.cloudfront\.net|.*\.githubusercontent\.com)$/i;

const BUILT_INS: MediaAdapter[] = [
  {
    name: "youtube",
    kind: "youtube",
    test: (url) => /youtube\.com|youtu\.be/.test(url),
    frame: (url) => {
      const video =
        id(url, /[?&]v=([\w-]{6,})/) ??
        id(url, /youtu\.be\/([\w-]{6,})/) ??
        id(url, /embed\/([\w-]{6,})/) ??
        id(url, /shorts\/([\w-]{6,})/);
      // The no-cookie host: an embedded timeline should not be why a reader
      // picks up a tracking cookie from a third party.
      return video ? `https://www.youtube-nocookie.com/embed/${video}` : null;
    },
  },
  {
    name: "vimeo",
    kind: "vimeo",
    test: (url) => /vimeo\.com/.test(url),
    frame: (url) => {
      const video = id(url, /vimeo\.com\/(?:video\/)?(\d+)/);
      return video ? `https://player.vimeo.com/video/${video}` : null;
    },
  },
  {
    name: "twitter",
    kind: "twitter",
    test: (url) => /(?:twitter|x)\.com\/[^/]+\/status\/\d+/.test(url),
    frame: (url) => {
      const status = id(url, /\/status\/(\d+)/);
      // The iframe endpoint rather than the widget script: no third-party
      // JavaScript on the page, and nothing to load before the pane paints.
      return status
        ? `https://platform.twitter.com/embed/Tweet.html?id=${status}&dnt=true`
        : null;
    },
  },
  {
    name: "bluesky",
    kind: "bluesky",
    test: (url) => /bsky\.app\/profile\/[^/]+\/post\/\w+/.test(url),
    frame: (url) => {
      const match = url.match(/profile\/([^/]+)\/post\/(\w+)/);
      if (!match) return null;
      return `https://embed.bsky.app/embed/${match[1]}/app.bsky.feed.post/${match[2]}`;
    },
  },
  {
    name: "soundcloud",
    kind: "soundcloud",
    test: (url) => /soundcloud\.com/.test(url),
    frame: (url) =>
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        url,
      )}&hide_related=true&show_comments=false&show_teaser=false&visual=true`,
  },
  {
    name: "bandcamp",
    kind: "bandcamp",
    test: (_url, hostname) => /bandcamp\.com$/i.test(hostname),
    // Bandcamp's embed needs a numeric album id that only appears in the page's
    // own markup, so a bare album URL cannot be turned into a player from the
    // outside. Claimed anyway, so it reads as a known host rather than a
    // stranger, and left to fall through to the link treatment.
    frame: () => null,
  },
  {
    name: "flickr",
    kind: "flickr",
    test: (url) => /flickr\.com\/photos\/[^/]+\/\d+/.test(url),
    frame: (url) => {
      const photo = id(url, /flickr\.com\/photos\/[^/]+\/(\d+)/);
      return photo ? `https://embedr.flickr.com/photos/${photo}` : null;
    },
  },
  {
    name: "archive.org",
    kind: "archive",
    test: (url) => /archive\.org\/(?:details|embed)\//.test(url),
    frame: (url) => {
      const item = id(url, /archive\.org\/(?:details|embed)\/([^/?#]+)/);
      return item ? `https://archive.org/embed/${item}` : null;
    },
  },
  {
    name: "image",
    kind: "image",
    test: (url, hostname) =>
      /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url) ||
      IMAGE_HOSTS.test(hostname),
    image: (url) => url,
  },
  {
    name: "wikipedia",
    kind: "wikipedia",
    test: (url, hostname) =>
      /(^|\.)wikipedia\.org$/i.test(hostname) && url.includes("/wiki/"),
    image: async (url) => {
      const title = id(url, /\/wiki\/([^?#]+)/);
      if (!title) return null;

      const host = new URL(url).hostname;
      const response = await fetch(
        `https://${host}/api/rest_v1/page/summary/${title}`,
      );
      if (!response.ok) return null;

      // Typed at the edge rather than trusted: this is a third party's JSON,
      // and the two fields actually wanted are the only ones described.
      const summary = (await response.json()) as {
        originalimage?: { source?: string };
        thumbnail?: { source?: string };
      };

      // An article with no picture is a page like any other.
      return summary?.originalimage?.source ?? summary?.thumbnail?.source ?? null;
    },
  },
];

const registry: MediaAdapter[] = [...BUILT_INS];

/**
 * Adds an adapter, ahead of the built-ins.
 *
 * Later registrations win, so a host handled badly by a built-in can be taken
 * over without editing this file.
 */
export function registerMedia(adapter: MediaAdapter): void {
  registry.unshift(adapter);
}

/** Everything currently registered, most recently added first. */
export const mediaAdapters = (): readonly MediaAdapter[] => registry;

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

/** Which adapter claims this URL, if any. */
export function adapterFor(url: string): MediaAdapter | null {
  const hostname = hostnameOf(url);
  return registry.find((adapter) => adapter.test(url, hostname)) ?? null;
}

export function mediaKind(url: string): MediaKind {
  return adapterFor(url)?.kind ?? "link";
}

/** Whether this link is worth giving half the pane to. */
export function canEmbed(url: string): boolean {
  const adapter = adapterFor(url);
  if (!adapter) return false;
  // An adapter that claims a host but cannot produce anything showable — a
  // Bandcamp album page, say — is a link with a nicer name.
  return Boolean(adapter.frame?.(url) ?? adapter.image);
}

/** The bit of a URL a reader recognises. */
export function hostLabel(url: string): string {
  const hostname = hostnameOf(url);
  return hostname ? hostname.replace(/^www\./, "") : url;
}

export type ResolvedMedia =
  | { type: "frame"; src: string; kind: MediaKind }
  | { type: "image"; src: string; kind: MediaKind }
  | { type: "link"; src: string; kind: MediaKind };

/**
 * What to actually put on screen for this URL.
 *
 * Async because some adapters have to ask before they know. Anything that
 * cannot be shown resolves as a link rather than throwing — a dead media URL is
 * a normal condition in a timeline someone maintains by hand, not an error.
 */
export async function resolveMedia(url: string): Promise<ResolvedMedia> {
  const adapter = adapterFor(url);
  if (!adapter) return { type: "link", src: url, kind: "link" };

  const frame = adapter.frame?.(url) ?? null;
  if (frame) return { type: "frame", src: frame, kind: adapter.kind };

  if (adapter.image) {
    try {
      const image = await adapter.image(url);
      if (image) return { type: "image", src: image, kind: adapter.kind };
    } catch {
      // A host that will not answer is a link, same as one that has no picture.
    }
  }

  return { type: "link", src: url, kind: "link" };
}
