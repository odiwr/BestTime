# Setting up your sheet

## 1. Make the sheet

Any Google Sheet works. Give it a header row and one row per event.

| Date | Display Date | Headline | Text | Media | Media Credit | Media Caption |
|------|--------------|----------|------|-------|--------------|---------------|
| `1969-07-20` | July 20, 1969 | Apollo 11 | Armstrong steps out. | `https://youtu.be/…` | NASA | Restored footage |

Only **Headline** and something that reads as a date are required.

### Column names

Matched loosely — case, underscores and hyphens are all ignored, and each field answers to several names:

| Field | Also accepts |
|---|---|
| `Date` | `Year`, `Start`, `Start Date`, `When` |
| `Display Date` | `Label`, `Date Label` |
| `Headline` | `Title`, `Name`, `Event` |
| `Text` | `Description`, `Body`, `Summary`, `Details` |
| `Media` | `URL`, `Link`, `Image`, `Source URL` |
| `Media Credit` | `Credit`, `Author` |
| `Media Caption` | `Caption`, `Alt` |
| `End` | `End Date`, `End Year` |

Any column BestTime does not recognise is kept on the event under `extra`, so nothing you write is thrown away.

## 2. Dates

**`Date` is what the timeline uses. `Display Date` is what the reader sees.** They are separate on purpose: you can place an event precisely and still label it "sometime around the turn of the century".

`Date` understands:

| You write | It means |
|---|---|
| `1969` | the year 1969 |
| `-700` | 700 BCE |
| `2020-03-15` | 15 March 2020 |
| `2020-03` | all of March 2020 |
| `March 15, 2020` | the same day |
| `15 March 2020` | the same day |

If `Date` is empty, `Display Date` is read as prose instead:

| You write | It means |
|---|---|
| `1970s` | 1970–1979 |
| `1970s–present` | 1970 to now |
| `1519-1544` | that range |
| `21st century` | 2001 to now |
| `late 20th–21st c.` | roughly 1967 onward |
| `c. 700 BCE` | around 700 BCE |
| `Modern` | 1950 to now |

Anything read from prose is drawn as a **hollow bar** rather than a solid one, so an inferred range never looks as certain as a recorded date. This is deliberate and is worth knowing when you decide which column to fill in.

### Spans

An event that covers a period gets an `End` column, or says so in prose. Both produce a bar reaching across what it covers rather than a dot pinned to a year nobody claimed.

### Future dates

By default anything past today is clamped to today, because on a history a century that runs to 2100 reserves most of the axis for years in which nothing has happened. **For a roadmap, set `max-year="none"`:**

```html
<best-time src="…" max-year="none"></best-time>
```

## 3. Publish it

**File → Share → Publish to web → Publish.** Publish the whole document, or just the sheet holding your events.

Copy the URL. All of these work:

- `https://docs.google.com/spreadsheets/d/e/2PACX-…/pubhtml`
- `https://docs.google.com/spreadsheets/d/e/2PACX-…/pubhtml?gid=123`
- `https://docs.google.com/spreadsheets/d/1AbC…/edit`
- any URL already ending `?output=csv`

BestTime rewrites whichever you give it to the CSV export.

> **Publishing is not the same as sharing.** A sheet set to "anyone with the link can view" is still not published, and BestTime cannot read it. You need the Publish to web step specifically.

## 4. Use it

```html
<best-time src="PASTE_THE_URL_HERE"></best-time>
```

Changes to the sheet appear on the page within about five minutes — Google's publish takes a moment, and BestTime caches the result for the rest of the reader's visit. Set `cache-ms="0"` while you are editing.

---

## Coming from TimelineJS

Point BestTime at your existing sheet. Nothing needs to change.

KnightLab's 19-column schema is read as-is: `Year`/`Month`/`Day` for placement, `End Year`/`End Month`/`End Day` for spans, and the media columns as they are. The columns BestTime has no use for are ignored rather than rejected.

Differences worth knowing:

- **`Time` is ignored.** BestTime's finest resolution is a day. A timeline where two events an hour apart need to be distinguishable is not one this draws well.
- **`Group`, `Background`, `Type` and `Media Thumbnail` do nothing.** Grouping in particular may come later — [say so in an issue](https://github.com/odiwr/BestTime/issues) if you want it, since that is the kind of thing that gets built when someone actually needs it.
- **A month is only applied to an exact year.** A row saying `1970s` in `Display Date` with a `7` in `Month` stays the decade — applying the month would invent a precision the row never had.

---

## Not using Google at all

The sheet is one option, not a requirement:

```html
<!-- A CSV anywhere -->
<best-time src="/data/timeline.csv"></best-time>

<!-- A JSON file: an array, or { "events": [...] } -->
<best-time src="/data/timeline.json"></best-time>
```

```js
// Or data you already have
import { fromData } from "besttime";

timeline.loader = fromData([
  { date: 1969, headline: "Apollo 11", text: "Armstrong steps out." },
]);
timeline.load();
```

JSON uses the same field names as the sheet columns, so moving between them means learning one vocabulary rather than two.
