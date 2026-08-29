/**
 * A CSV reader that understands quoting.
 *
 * Written out rather than pulled in. The text column of a timeline runs to
 * paragraphs and contains commas, quotes and newlines, so splitting on commas
 * loses rows — and a parser library for one file of seven columns is more
 * weight than the whole of this package.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  // A leading byte-order mark otherwise becomes part of the first header,
  // and the column lookup then misses it. Sheets exported from Excel have one.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted cell is one literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // A trailing newline produces one empty row. Nobody meant it.
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}
