# Issues to file at launch

Not documentation — a checklist for the maintainer. An empty issue tracker tells
a visitor there is nothing to do; ten real, well-scoped issues tell them where to
start. File these before announcing anything, label them as marked, and delete
this file once they exist.

The `gh` command for each is included so this takes ten minutes.

---

### 1. Support Mastodon posts
`good first issue` `media-adapter`

A Mastodon post URL should embed. Any instance, so the test has to be shape-based
(`/@user/123456789`) rather than a domain list. Mastodon serves oEmbed at
`/api/oembed?url=…` with permissive CORS.

See `docs/media-adapters.md`. Roughly fifteen lines plus a test.

```bash
gh issue create --title "Media: support Mastodon posts" --label "good first issue,media-adapter"
```

### 2. Support Spotify tracks and albums
`good first issue` `media-adapter`

`open.spotify.com/track/ID` → `open.spotify.com/embed/track/ID`. One of the
simplest adapters there is.

### 3. Support Bandcamp albums
`media-adapter` `help wanted`

Currently claimed but not embeddable: the player needs a numeric album id that
only appears in the page's own markup. Needs someone to work out whether their
oEmbed endpoint gives it up with CORS. May turn out to be impossible, which is a
perfectly good outcome to write down.

### 4. A dark theme, and two more
`good first issue` `theme`

`themes/` has three. It wants a high-contrast dark, something for newsrooms, and
something ugly and fun. No JavaScript required — see `CONTRIBUTING.md`.

### 5. A pinch-and-drag axis for phones
`help wanted` `enhancement`

Below 640px the axis is hidden entirely and readers get only the prev/next
arrows. That was the right call for a first version and is the biggest gap in
the project. Needs pointer-event handling for two-finger pinch and a layout that
survives 375px.

Start in `packages/element/src/styles.ts` (the `@container (min-width: 640px)`
guard on `.bt-axis`) and `element.ts` (`#bindAxis`).

### 6. Non-English dates
`help wanted` `parser`

`packages/core/src/prose.ts` understands English month names and English words
for periods. A sheet written in French, Spanish or German currently falls back to
a bare year at best.

Wants a design discussion before code: probably a pluggable locale table rather
than a growing pile of regexes. Comment before starting.

### 7. Group events into rows
`enhancement` `discussion`

TimelineJS has a `Group` column. Honouring it would mean lanes are assigned by
group rather than purely by packing — useful for parallel tracks (one row per
country, per team, per person).

This changes `packLanes` and wants thinking about before code.

### 8. A `<script type="application/json">` data source
`good first issue`

```html
<best-time>
  <script type="application/json">[{ "date": 1969, "headline": "Apollo 11" }]</script>
</best-time>
```

Inline data with no JavaScript at all. The parsing already exists
(`eventsFromObjects`); this is about reading the child script in
`connectedCallback` before falling back to `src`.

### 9. Export the current view as an image
`enhancement` `help wanted`

"Download this timeline as a PNG" is the most predictable feature request a
project like this gets. Canvas rendering of the axis, or `foreignObject` in an
SVG. Worth having an opinion ready.

### 10. The docs site and playground
`help wanted` `docs`

Paste a sheet URL, see it render, copy the embed snippet. This is simultaneously
the demo, the onboarding path, and the best debugging tool for anyone filing a
bug about their own sheet. Astro on Cloudflare Pages.

### 11. Verify against a real TimelineJS sheet
`good first issue` `test`

The TimelineJS compatibility is covered by hand-written fixtures. Someone with a
real, published, large TimelineJS sheet should point BestTime at it and report
what breaks. Very likely finds something.

---

## Labels to create

```bash
gh label create "good first issue" --color 7057ff --description "Small, self-contained, well described"
gh label create "media-adapter"    --color 0e8a16 --description "Support for a new media host"
gh label create "theme"            --color d4c5f9 --description "CSS only, no JavaScript needed"
gh label create "parser"           --color fbca04 --description "Reading dates and sheets"
gh label create "help wanted"      --color 008672
gh label create "discussion"       --color c2e0c6 --description "Wants agreement before code"
```
