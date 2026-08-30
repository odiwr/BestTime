<div align="center">

# BestTime

**A zoomable timeline that reads a Google Sheet.**

Fork a spreadsheet, publish it to the web, paste the link. That is the whole setup.

[Quick start](#quick-start) · [Why](#why-another-timeline) · [Options](#options) · [Frameworks](#every-other-framework) · [Contributing](CONTRIBUTING.md)

</div>

---

## Quick start

```html
<script src="https://cdn.jsdelivr.net/npm/besttime@1"></script>

<best-time src="https://docs.google.com/spreadsheets/d/e/YOUR_ID/pubhtml"></best-time>
```

That is a working timeline. No build step, no framework, no server.

**Getting the link:** in your sheet, *File → Share → Publish to web → Publish*, then paste the URL it gives you. BestTime rewrites it to the CSV export on your behalf, so `/pubhtml`, `/edit` and a direct `?output=csv` link all work.

### Your sheet

| Date | Display Date | Headline | Text | Media | Media Credit | Media Caption |
|------|--------------|----------|------|-------|--------------|---------------|
| `1969-07-20` | July 20, 1969 | Apollo 11 | Armstrong steps out. | `https://youtu.be/…` | NASA | Restored footage |
| | 1970s–present | Deep time | A period, not a moment. | | | |
| `-700` | c. 700 BCE | Early writing | Something old. | | | |

Only **Headline** and something that reads as a date are required. Column names are matched loosely, so `title`/`name`, `description`/`body`, and `start_date`/`year` all work.

> **Already have a TimelineJS sheet?** Point BestTime at it unchanged. KnightLab's 19-column schema is read as-is, including `End Year` for spans.

---

## Why another timeline

Two things this does that the others do not.

**The axis compresses empty time.** A history running 700 BCE to now, with most of its events after 1900, is almost entirely blank on a straight axis — and the interesting part is squeezed into a few unreadable pixels. BestTime collapses quiet stretches to a fixed width and *says so* with a break mark, so the space goes where the events are and nothing is silently misrepresented.

**Zoom is continuous, not a set of levels.** Most timelines snap between "decades" and "years" because those are two separate layouts. Here the tick ladder is chosen from the current zoom, so the axis re-labels itself as it moves and every frame in between is real. Scroll far enough into a single year and the ticks become months, then days — the same code that writes `700 BCE` at the other end.

Everything is derived from your data, so the same component draws a conference schedule, a product roadmap, and the Pleistocene without being configured. (There is a test that scales every date by 10,000× and asserts the axis comes out identical.)

---

## Options

Every option is an attribute, so they work identically in HTML and in every framework.

```html
<best-time
  src="https://docs.google.com/…/pubhtml"
  height="620"
  axis-height="300"
  theme="dark"
  accent="#3f9f77"
  max-year="none"
  collapse-gaps="false"
  remember="false"
></best-time>
```

| Attribute | Default | What it does |
|---|---|---|
| `src` | — | Published sheet, `.csv`, or `.json`. The loader is picked from the URL. |
| `height` | `620px` | Total height. A bare number means pixels. |
| `axis-height` | `300px` | Height of the axis strip within that. |
| `theme` | follows the reader's OS | `light` or `dark` to force one. |
| `accent` | `#588dbc` | Any CSS colour. Shorthand for `--bt-accent`. |
| `max-year` | current year | Latest year any span may reach. **Set `none` for roadmaps** — otherwise future dates are clamped to today, which is what you want for a history and not for a plan. |
| `min-year` | unbounded | Earliest year any span may reach. |
| `collapse-gaps` | `true` | `false` draws true distances and never compresses. |
| `remember` | `true` | `false` stops remembering which event was last open. |
| `cache-ms` | `300000` | How long a fetched sheet stays cached in the tab. `0` disables. |

### Theming

> **If your page is light-only, say so.** By default the element follows the *reader's* system setting, not your page — so a visitor with dark mode enabled gets a dark timeline against your white background. Add `theme="light"` (or `theme="dark"`) to pin it. Leave it off only if your own page also responds to `prefers-color-scheme`.

The element is styled entirely through custom properties, which cross the shadow boundary. Set them from your own CSS:

```css
best-time {
  --bt-accent: #b4472a;
  --bt-surface: #fffdf7;
  --bt-ink: #241d16;
  --bt-radius: 2px;
  --bt-font: "Iowan Old Style", Georgia, serif;
}
```

Ready-made sets live in [`themes/`](themes/). Contributing one is the easiest useful PR in the repo.

### Events

```js
const timeline = document.querySelector("best-time");

timeline.addEventListener("besttime:load",   (e) => e.detail.events);
timeline.addEventListener("besttime:select", (e) => e.detail.event);
timeline.addEventListener("besttime:error",  (e) => e.detail.error);
```

### Data without a sheet

```js
import { fromData, fromJson, fromCsv } from "besttime";

timeline.loader = fromData([
  { date: 1969, headline: "Apollo 11", text: "Armstrong steps out." },
]);
timeline.load();
```

Google is one option, not a dependency — which matters, because their CSV endpoint rate-limits and is not a contract anyone signed.

---

## Every other framework

Custom elements are native to the browser, so `<best-time>` works anywhere HTML does. A few specifics:

<details>
<summary><b>React / Next.js</b></summary>

```bash
npm install @besttime/react
```

```jsx
import { BestTime } from "@besttime/react";

<BestTime
  src="https://docs.google.com/…/pubhtml"
  accent="#3f9f77"
  onSelect={(event) => console.log(event.headline)}
/>
```

The wrapper is typed and defers registration to an effect, so it is safe in a Next.js app without a `dynamic()` import. React 19 renders custom elements natively, so you can also skip the wrapper and use `<best-time>` directly.
</details>

<details>
<summary><b>Vue</b></summary>

```js
// vite.config.js — tells the compiler this tag is not a Vue component
export default {
  plugins: [vue({
    template: { compilerOptions: { isCustomElement: (tag) => tag === "best-time" } },
  })],
};
```

```vue
<script setup>import "besttime";</script>
<template><best-time :src="url" /></template>
```
</details>

<details>
<summary><b>Svelte, Astro, Solid, plain Vite</b></summary>

```js
import "besttime";
```

Then use `<best-time src="…">` in markup. No configuration needed in any of them.
</details>

<details>
<summary><b>WordPress, Ghost, Notion-style embeds</b></summary>

Paste into a Custom HTML block:

```html
<script src="https://cdn.jsdelivr.net/npm/besttime@1"></script>
<best-time src="https://docs.google.com/…/pubhtml"></best-time>
```
</details>

Runnable versions of all of these are in [`examples/`](examples/).

---

## Packages

| Package | Size | What it is |
|---|---|---|
| [`besttime`](packages/element) | ~41 KB min | The `<best-time>` element. **Start here.** Zero dependencies. |
| [`@besttime/core`](packages/core) | ~26 KB | Parsing and axis maths. No DOM — runs in Node, for static generation or validating a sheet in CI. |
| [`@besttime/react`](packages/react) | ~2 KB | Typed React wrapper. |

---

## Media

A link in the Media column is shown in place where the host allows it, and left as a plain link where it does not — an article gets no half-width grey box, it gets the words instead.

Supported today: YouTube, Vimeo, Flickr, Twitter/X, Bluesky, SoundCloud, Internet Archive, Wikipedia (fetches the article's lead image), and direct images.

Adding a host is a self-contained ~15 lines and is the best first contribution in the project:

```js
import { registerMedia } from "besttime";

registerMedia({
  name: "example",
  kind: "image",
  test: (url, hostname) => hostname === "pictures.example.com",
  image: (url) => url,
});
```

See [docs/media-adapters.md](docs/media-adapters.md).

---

## Contributing

Genuinely wanted, and [CONTRIBUTING.md](CONTRIBUTING.md) says what is most useful. The short version:

- **Themes** — a CSS file. No JavaScript knowledge required.
- **Media adapters** — support a new host in about fifteen lines.
- **Framework examples** — one folder, one config.
- **The gallery** — built something? Add it to [`docs/gallery.json`](docs/gallery.json).

The parser and the axis maths are covered by 82 tests, so changes to the hard parts are safe to make and safe to merge.

```bash
git clone https://github.com/odiwr/BestTime.git
cd BestTime && npm install
npm test
npm run build && npm run dev   # examples on http://localhost:4178
```

---

## Support

BestTime is free and always will be — MIT, no paid tier, no telemetry, nothing to sign up for. If it saved you an afternoon, [buying me a coffee](https://buymeacoffee.com/odiwr) or [sponsoring on GitHub](https://github.com/sponsors/odiwr) is appreciated and never required.

## License

[MIT](LICENSE).
