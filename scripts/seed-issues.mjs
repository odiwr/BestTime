/**
 * Files the starter issues.
 *
 * An empty issue tracker tells a visitor there is nothing to do here. A dozen
 * real, scoped issues tells them where to start — so this exists to make the
 * boring part of launching a project take seconds instead of half an hour of
 * copy-paste into a browser form.
 *
 * Run it once:
 *
 *   node scripts/seed-issues.mjs            # create everything
 *   node scripts/seed-issues.mjs --dry-run  # show what would be created
 *   node scripts/seed-issues.mjs --print    # dump markdown to paste by hand
 *
 * Needs the GitHub CLI (`gh auth login`) for anything but --print.
 */
import { spawnSync } from "node:child_process";

const REPO = "odiwr/BestTime";
const BLOB = `https://github.com/${REPO}/blob/main`;

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const PRINT = args.has("--print");

/**
 * Labels that must exist before an issue can carry them.
 *
 * GitHub ships `good first issue`, `help wanted`, `enhancement`,
 * `documentation` and `bug` already, so only the project's own are here.
 * Creating one that exists is not an error worth stopping for.
 */
const LABELS = [
  ["media-adapter", "0e8a16", "Support for embedding a new media host"],
  ["theme", "d4c5f9", "CSS only — no JavaScript needed"],
  ["parser", "fbca04", "Reading dates, sheets, and CSV"],
  ["discussion", "c2e0c6", "Needs agreement on approach before code"],
];

const ISSUES = [
  {
    title: "Media: support Mastodon posts",
    labels: ["good first issue", "media-adapter"],
    body: `A Mastodon post URL should embed in the media pane.

Mastodon is federated, so there is no domain list to match against — the test
has to be shape-based, something like \`/@user/123456789\` at the end of the
path. Mastodon instances serve oEmbed at \`/api/oembed?url=…\` with permissive
CORS, which is what makes this possible from the browser.

**Where to start**

- [docs/media-adapters.md](${BLOB}/docs/media-adapters.md) — the walkthrough
- [packages/core/src/media.ts](${BLOB}/packages/core/src/media.ts) — the existing adapters
- [packages/core/test/parse.test.ts](${BLOB}/packages/core/test/parse.test.ts) — where the test goes

Roughly fifteen lines plus a test. Say so here and it is yours.`,
  },
  {
    title: "Media: support Spotify tracks and albums",
    labels: ["good first issue", "media-adapter"],
    body: `\`open.spotify.com/track/ID\` should embed as \`open.spotify.com/embed/track/ID\`.
Same for \`/album/\`, \`/playlist/\` and \`/episode/\`.

Probably the simplest adapter in the list — a regex and a string. Good first
issue if you have never touched this codebase.

See [docs/media-adapters.md](${BLOB}/docs/media-adapters.md).`,
  },
  {
    title: "Media: work out whether Bandcamp can be embedded",
    labels: ["media-adapter", "help wanted"],
    body: `Bandcamp is currently *claimed* by an adapter but returns \`null\`, so it falls
through to a plain link.

The reason: their player embed needs a numeric album id that only appears in the
page's own markup, and a bare album URL cannot be turned into a player from
outside without fetching and scraping the page.

**The actual task is research, not code.** Does their oEmbed endpoint give up
the id, and does it send CORS headers permissive enough to be called from a
reader's browser?

"No, it is not possible" is a completely acceptable outcome — write down what
you found and we will note it in the docs.

See the \`bandcamp\` entry in [packages/core/src/media.ts](${BLOB}/packages/core/src/media.ts).`,
  },
  {
    title: "Themes: a dark one, a newsroom one, and something fun",
    labels: ["good first issue", "theme"],
    body: `[themes/](${BLOB}/themes) has three: default, parchment, and high-contrast.

Wanted:
- A proper dark theme (not just the automatic dark variant)
- Something sober, for newsrooms and institutions
- Something loud and fun

**No JavaScript required.** A theme is one CSS file of custom properties. Copy
[themes/default.css](${BLOB}/themes/default.css), change the values, save it
under a new name, open a PR with a screenshot.

One theme per PR, please — easier to review and to credit.`,
  },
  {
    title: "A usable axis on phones",
    labels: ["enhancement", "help wanted"],
    body: `Below 640px the axis is hidden entirely and readers get only the previous/next
arrows. That was a deliberate call for the first version — a draggable,
zoomable ruler eight rows deep is not usable at 375px, and faking one costs
more than it gives.

It is also the biggest gap in the project, and probably affects half the
traffic of any public timeline.

**Needs**
- Pinch-to-zoom and drag-to-pan via pointer events
- A layout that survives 375px — likely fewer rows and shorter labels
- Not breaking the desktop behaviour

**Where**
- \`@container (min-width: 640px)\` guard on \`.bt-axis\` in [packages/element/src/styles.ts](${BLOB}/packages/element/src/styles.ts)
- \`#bindAxis\` in [packages/element/src/element.ts](${BLOB}/packages/element/src/element.ts)

Worth commenting with your approach before writing much.`,
  },
  {
    title: "Dates in languages other than English",
    labels: ["help wanted", "parser", "discussion"],
    body: `[packages/core/src/prose.ts](${BLOB}/packages/core/src/prose.ts) understands
English month names and English words for periods — "1970s", "21st century",
"present", "late", "mid", "early".

A sheet written in French, Spanish, German or anything else falls back to a
bare year at best, and to nothing at all at worst.

**This wants a design discussion before code.** The likely shape is a pluggable
locale table rather than a growing pile of regexes, plus a \`locale\` attribute
on the element. Non-Gregorian calendars are a separate and much larger question.

Comment with your thinking before starting — this is the kind of change that is
painful to redo.`,
  },
  {
    title: "Honour the Group column to build parallel rows",
    labels: ["enhancement", "discussion"],
    body: `TimelineJS sheets have a \`Group\` column. BestTime currently ignores it.

Honouring it would mean lanes are assigned by group rather than purely by
packing — one row per country, per team, per person — which turns a single
timeline into a comparison of several.

**Design questions to settle first**
- Does a group get a fixed row, or a band of rows it packs within?
- What happens when a group needs more rows than fit?
- Are groups labelled down the left edge, and does that eat horizontal space?

Affects \`packLanes\` in [packages/core/src/scale.ts](${BLOB}/packages/core/src/scale.ts)
and the layout in [packages/element/src/axis.ts](${BLOB}/packages/element/src/axis.ts).

Discussion first, please.`,
  },
  {
    title: "Read inline data from a <script type=\"application/json\"> child",
    labels: ["good first issue", "enhancement"],
    body: `Let a page supply events inline, with no JavaScript at all:

\`\`\`html
<best-time>
  <script type="application/json">
    [{ "date": 1969, "headline": "Apollo 11", "text": "Armstrong steps out." }]
  </script>
</best-time>
\`\`\`

The parsing already exists — \`eventsFromObjects\` in
[packages/core/src/parse.ts](${BLOB}/packages/core/src/parse.ts). This is about
reading the child script in \`connectedCallback\` and using it in preference to
\`src\` when both are present.

**Watch out for:** the child may not be parsed yet when \`connectedCallback\`
runs for an element in the initial HTML. Worth checking what the timing
actually is rather than assuming.

See \`connectedCallback\` and \`load()\` in [packages/element/src/element.ts](${BLOB}/packages/element/src/element.ts).`,
  },
  {
    title: "Export the current view as an image",
    labels: ["enhancement", "help wanted"],
    body: `"Can I download this timeline as a PNG" is the most predictable feature request
a project like this gets, and it is worth having an answer ready.

Two plausible approaches:
- Redraw the axis to a \`<canvas>\` — full control, duplicates the layout code
- Serialise to SVG with \`<foreignObject>\` — reuses the DOM, patchy support

Both have to deal with cross-origin images in the media pane, which will taint
a canvas and block export.

Worth a comment describing the approach before building it.`,
  },
  {
    title: "Audit keyboard and screen-reader support",
    labels: ["accessibility", "help wanted"],
    body: `The axis has had reasonable-but-unverified accessibility work: markers are real
\`<button>\`s with \`aria-label\` and \`aria-pressed\`, arrow keys step through
events in order, and \`prefers-reduced-motion\` shortens the transitions.

None of it has been tested with an actual screen reader.

**Wanted**
- A pass with NVDA, JAWS or VoiceOver, reporting what is confusing or missing
- Does the detail pane announce when the selection changes? It probably should
  be a live region and currently is not
- Is tabbing through thirty markers reasonable, or does it need a roving
  tabindex?
- Focus visibility on the axis itself

A written report is a complete and valuable contribution here — you do not have
to fix what you find.`,
  },
  {
    title: "Docs site and live playground",
    labels: ["documentation", "help wanted"],
    body: `A page where you paste a published sheet URL, watch it render, and copy the
embed snippet.

It is simultaneously the demo, the onboarding path, and the best debugging tool
for anyone filing a bug about their own sheet — "paste your URL into the
playground and tell me what happens" resolves most support questions on its own.

The showcase site is going to live at **besttime.odiwr.com** and is handled
separately; this issue is about the playground itself, which could live in this
repo and be embedded there.

Static hosting, no backend needed — everything runs in the browser already.`,
  },
  {
    title: "Test against a real, large TimelineJS sheet",
    labels: ["good first issue", "help wanted"],
    body: `TimelineJS compatibility is covered by hand-written fixtures in
[packages/core/test/parse.test.ts](${BLOB}/packages/core/test/parse.test.ts) —
the 19-column header, split \`Year\`/\`Month\`/\`Day\`, and \`End Year\`.

Nobody has yet pointed BestTime at a real published TimelineJS sheet with a few
hundred rows in it.

**The task:** find or make one, point the element at it, and report what breaks.
Very likely something does — odd date formats, empty rows, media hosts we do
not handle, or performance with that many markers.

No code required to be useful. A screenshot and a description of what went
wrong is a complete contribution, and the sheet URL turns an afternoon of
guessing into a five-minute fix.`,
  },
];

/* ------------------------------------------------------------------ */

function run(args) {
  const result = spawnSync("gh", args, { encoding: "utf8", shell: true });
  return {
    ok: result.status === 0,
    out: (result.stdout ?? "").trim(),
    err: (result.stderr ?? "").trim(),
  };
}

if (PRINT) {
  // Everything needed to file these by hand, in order, in one place.
  const parts = ISSUES.map(
    (issue, i) =>
      `${"=".repeat(72)}\n### ${i + 1}. ${issue.title}\n` +
      `LABELS: ${issue.labels.join(", ")}\n${"-".repeat(72)}\n${issue.body}\n`,
  );
  console.log(parts.join("\n"));
  process.exit(0);
}

const version = run(["--version"]);
if (!version.ok) {
  console.error(
    [
      "The GitHub CLI is not installed.",
      "",
      "  winget install --id GitHub.cli",
      "",
      "Then reopen your terminal and run:",
      "",
      "  gh auth login",
      "",
      "Or, to file these by hand instead:",
      "",
      "  node scripts/seed-issues.mjs --print",
    ].join("\n"),
  );
  process.exit(1);
}

const auth = run(["auth", "status"]);
if (!auth.ok) {
  console.error("Not logged in. Run:\n\n  gh auth login\n");
  process.exit(1);
}

console.log(`Repository: ${REPO}`);
console.log(DRY ? "Dry run — nothing will be created.\n" : "");

for (const [name, color, description] of LABELS) {
  if (DRY) {
    console.log(`label   ${name}`);
    continue;
  }

  const result = run([
    "label", "create", JSON.stringify(name),
    "--repo", REPO,
    "--color", color,
    "--description", JSON.stringify(description),
  ]);

  // Already existing is the normal case on a second run, not a failure.
  const exists = /already exists/i.test(result.err);
  console.log(`label   ${name} ${result.ok ? "created" : exists ? "(exists)" : "FAILED: " + result.err}`);
}

console.log("");

let made = 0;
for (const issue of ISSUES) {
  if (DRY) {
    console.log(`issue   ${issue.title}  [${issue.labels.join(", ")}]`);
    continue;
  }

  const result = run([
    "issue", "create",
    "--repo", REPO,
    "--title", JSON.stringify(issue.title),
    "--body", JSON.stringify(issue.body),
    ...issue.labels.flatMap((label) => ["--label", JSON.stringify(label)]),
  ]);

  if (result.ok) {
    made += 1;
    console.log(`issue   ${result.out}`);
  } else {
    console.log(`issue   FAILED "${issue.title}"\n        ${result.err}`);
  }
}

if (!DRY) {
  console.log(`\n${made}/${ISSUES.length} issues created.`);
  console.log(`https://github.com/${REPO}/issues`);
}
