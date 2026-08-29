# Contributing

Contributions are genuinely welcome, including your first one ever.

This page is ordered by how useful a contribution is *and* how easy it is to make. The things at the top need no JavaScript.

---

## Ways in, easiest first

### 1. A theme — no JavaScript required

The element is styled entirely through CSS custom properties. A theme is one file of variables.

Copy [`themes/default.css`](themes/default.css), change the values, save it as `themes/your-name.css`, and open a PR. Include a screenshot in the description.

```css
best-time[data-theme="parchment"] {
  --bt-accent: #b4472a;
  --bt-surface: #fffdf7;
  --bt-ink: #241d16;
  --bt-font: "Iowan Old Style", Georgia, serif;
}
```

### 2. Your timeline in the gallery

Built something public? Add an entry to [`docs/gallery.json`](docs/gallery.json) with a title, URL, and one-line description. That is the whole PR.

### 3. A media adapter — about fifteen lines

Support for a new host lives in one self-contained object. See [docs/media-adapters.md](docs/media-adapters.md) for the walkthrough, and [`packages/core/src/media.ts`](packages/core/src/media.ts) for the existing ones.

Wanted: Bandcamp (needs the numeric album id), Mastodon, Spotify, Google Arts & Culture, IIIF viewers, Europeana.

### 4. A framework example

One folder under [`examples/`](examples/) with the smallest thing that runs. Nuxt, SvelteKit, Astro, Rails, Django, Hugo, Eleventy are all missing.

### 5. Date formats

[`packages/core/src/prose.ts`](packages/core/src/prose.ts) turns what a source *says* into a span. It currently understands English and a handful of shapes. If it mis-reads a date you actually have in a sheet, that is a bug worth filing — with the exact cell contents — and usually a small fix plus a test.

Non-English dates and non-Gregorian calendars are wide open.

### 6. The hard parts

`scale.ts` is the compressed axis; `axis.ts` is the layout. Both are covered by tests, so you can change them with a safety net. Read the comments first — most of the constants have a reason, and the reason is written down next to them.

---

## Setup

```bash
git clone https://github.com/odiwr/BestTime.git
cd BestTime
npm install
npm test
npm run build
npm run dev          # examples on http://localhost:4178
```

Node 20 or newer. No other tooling.

### Layout

```
packages/core      Parsing + axis maths. No DOM, no framework, no dependencies.
packages/element   The <best-time> custom element. Depends only on core.
packages/react     Thin typed React wrapper.
examples/          One folder per framework.
themes/            CSS variable sets.
docs/              Guides and the gallery.
```

**The one architectural rule:** nothing in `packages/core` may touch the DOM. Its `tsconfig.json` drops the DOM lib specifically so that an accidental `document` is a compile error rather than a crash in somebody's Node build. If you need browser-only behaviour there, feature-detect it through `globalThis` — see `cacheStore()` in `loaders.ts` for the pattern.

---

## Tests

```bash
npm test              # once
npm run test:watch    # while working
```

Every change to `packages/core` needs a test. It is 82 tests today and that is the only reason the axis maths are safe for a stranger to modify.

The most valuable tests are **properties**, not examples. The best one in the suite scales every date by 10,000× and asserts the axis comes out identical — that single test is what stops anyone reintroducing a hardcoded "60 years" threshold that would break every timeline that is not a human history.

Write the test so its comment says *what would break* if the behaviour regressed, not what the code does.

---

## Pull requests

- Branch from `main`.
- One concern per PR. A theme and a bug fix are two PRs.
- `npm test` and `npm run build` both pass.
- Describe the behaviour you changed, and why. Screenshots for anything visual.

Do not worry about changelogs, version numbers, or squashing — that is handled on merge.

### Style

Match what is around you. Two things that are genuinely enforced by review:

**Comments explain *why*, not *what*.** The codebase is unusually heavily commented and that is deliberate. A comment saying `// increment the counter` will be removed; one saying why the counter starts at 1 will be kept forever.

**No dependencies in `core` or `element`.** Not "few". None. The CSV parser is written out by hand because a parser library for seven columns weighs more than this entire package, and a `<script>` tag embed that drags in a tree of transitive dependencies is not one anybody will paste into their site. If you think something needs a dependency, open an issue first — the answer is not automatically no, but it is the highest bar in the project.

---

## Reporting a bug

The most useful bug report contains **the sheet**. A published Google Sheet URL, or the two rows of CSV that reproduce it, turns an afternoon of guessing into a five-minute fix.

Use the [issue templates](https://github.com/odiwr/BestTime/issues/new/choose) — they ask for what is actually needed.

---

## Governance, such as it is

This is a small project. Right now @odiwr merges things. If you land a few PRs and want commit access, ask — it will probably be yes.

Decisions are made in issues, in public. If something in here does not make sense, that is a documentation bug and worth filing.

---

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). It is the Contributor Covenant, and it is enforced.
