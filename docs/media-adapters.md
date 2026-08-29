# Writing a media adapter

An adapter teaches BestTime to show links from one host in place, instead of leaving them as a plain link. Each one is a self-contained object of about fifteen lines, and adding one is the most self-contained useful change you can make to this project.

## The shape

```ts
type MediaAdapter = {
  name: string;
  kind: MediaKind;

  /** Does this adapter claim the URL? Gets the raw string and the hostname. */
  test: (url: string, hostname: string) => boolean;

  /** An iframe URL, if it embeds through one. */
  frame?: (url: string) => string | null;

  /** A picture, if it resolves to one. May be async. */
  image?: (url: string) => string | null | Promise<string | null>;
};
```

An adapter supplies `frame`, or `image`, or neither. `frame` wins when both are present.

## Registering one

```js
import { registerMedia } from "besttime";

registerMedia({
  name: "example-pics",
  kind: "image",
  test: (url, hostname) => hostname === "pictures.example.com",
  image: (url) => url,
});
```

Registrations go to the front of the list, so you can also take over a host a built-in handles badly — useful before a fix is released.

To contribute one, add it to the `BUILT_INS` array in [`packages/core/src/media.ts`](../packages/core/src/media.ts) and a case to `packages/core/test/parse.test.ts`.

## Three worked examples

### An iframe host

The commonest case. Pull the id out of the URL and build the embed URL.

```js
{
  name: "vimeo",
  kind: "vimeo",
  test: (url) => /vimeo\.com/.test(url),
  frame: (url) => {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  },
}
```

Return `null` rather than a broken URL when the pattern does not match. A `null` falls through to the link treatment, which is correct — an unrecognised Vimeo URL is still a Vimeo page.

### A host that needs asking

Wikipedia has no iframe, but it will hand over an article's lead image, and a portrait is worth more than a link to the page about the person.

```js
{
  name: "wikipedia",
  kind: "wikipedia",
  test: (url, hostname) =>
    /(^|\.)wikipedia\.org$/i.test(hostname) && url.includes("/wiki/"),
  image: async (url) => {
    const title = url.match(/\/wiki\/([^?#]+)/)?.[1];
    if (!title) return null;

    const host = new URL(url).hostname;
    const res = await fetch(`https://${host}/api/rest_v1/page/summary/${title}`);
    if (!res.ok) return null;

    const summary = await res.json();
    return summary?.originalimage?.source ?? summary?.thumbnail?.source ?? null;
  },
}
```

Two rules for async adapters:

- **The endpoint must send `Access-Control-Allow-Origin`.** This runs in the reader's browser, from whatever origin the page is on. An API that needs a server-side proxy cannot be an adapter.
- **Never throw.** Return `null`. A host being down, rate-limiting, or having no picture for this item are all normal conditions in a timeline someone maintains by hand, and none of them should break the pane.

### A host you can recognise but not embed

Claim it anyway. A named host reads better than a stranger, and it documents that the case was considered rather than missed.

```js
{
  name: "bandcamp",
  kind: "bandcamp",
  test: (_url, hostname) => /bandcamp\.com$/i.test(hostname),
  // The embed needs a numeric album id that only appears in the page's own
  // markup, so a bare album URL cannot be turned into a player from outside.
  frame: () => null,
}
```

## Getting `test` right

`test` receives the raw URL and the parsed hostname. Use the hostname for anything domain-based — matching `/twitter\.com/` against the whole string also matches `https://evil.example/?ref=twitter.com`.

Hostname patterns should be anchored:

```js
// Matches twitter.com and www.twitter.com; not nottwitter.com.
test: (_url, hostname) => /(^|\.)twitter\.com$/i.test(hostname),
```

`hostname` is `""` for a value that is not a URL at all. Sheet cells routinely contain things like "see the attached scan", and every adapter has to survive that without throwing.

## Privacy

Embeds are third parties running on someone else's page. Two things are expected of a contributed adapter:

- **Prefer a no-cookie or do-not-track variant** where the host offers one. YouTube gets `youtube-nocookie.com`; Twitter gets `&dnt=true`.
- **Prefer an iframe endpoint over a widget script.** A `<script>` from another origin runs with full access to the host page. The element sandboxes iframes and never injects third-party script.

## What `kind` is for

`kind` is a label used for styling hooks and for `mediaKind()`. If none of the existing values fit, add one to the `MediaKind` union in [`types.ts`](../packages/core/src/types.ts). It is a plain string union, so this costs nothing.

## Testing yours

```js
import { mediaKind, canEmbed, resolveMedia } from "@besttime/core";

expect(mediaKind("https://vimeo.com/12345")).toBe("vimeo");
expect(canEmbed("https://vimeo.com/12345")).toBe(true);
expect(await resolveMedia("https://vimeo.com/12345")).toMatchObject({
  type: "frame",
});
```

Include a case for a URL from the host that your adapter should *not* claim, and one for a non-URL string.
