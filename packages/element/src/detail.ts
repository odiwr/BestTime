import { hostLabel, resolveMedia, type TimelineEvent } from "@besttime/core";

/**
 * The upper half: what the selected event actually is.
 *
 * Media on the left, words on the right. A fixed height, so moving between
 * events never resizes the pane and shunts the axis around — the axis is the
 * thing being aimed at, and a target that moves when you hit it is unusable.
 *
 * Transitions cross-fade on the event's id, so scrubbing quickly reads as one
 * surface changing rather than a stack of panes. The Web Animations API rather
 * than an animation library: two keyframes, cancellable, already in the browser.
 */

const FADE_MS = 280;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * What the source link says.
 *
 * The credit line and the caption are one thing, said once, as the link. Given
 * neither, the host is at least honest about where the reader is being sent.
 */
function sourceLabel(event: TimelineEvent): string {
  const parts = [event.mediaCaption, event.mediaCredit].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return event.media ? hostLabel(event.media) : "Source";
}

export class Detail {
  readonly el: HTMLDivElement;

  #current: HTMLElement | null = null;
  #shownId: string | null = null;

  /**
   * Which resolve is the live one.
   *
   * Media resolution is async — a Wikipedia lead image takes a round trip — and
   * a reader holding the arrow key can move on three times before the first
   * answer lands. Without this, a stale picture arrives and paints itself over
   * whatever is now selected.
   */
  #token = 0;

  constructor(private readonly doc: Document) {
    this.el = doc.createElement("div");
    this.el.className = "bt-detail";
    this.el.setAttribute("part", "detail");
  }

  /** Framing for a picture the frame has to crop, by URL. */
  crops: Record<string, number> = {};

  show(event: TimelineEvent | null): void {
    if (event?.id === this.#shownId) return;
    this.#shownId = event?.id ?? null;

    const token = ++this.#token;
    const next = event ? this.#article(event) : this.#empty();

    const previous = this.#current;
    this.#current = next;
    this.el.append(next);

    next.animate(
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: FADE_MS, easing: EASE, fill: "backwards" },
    );

    if (previous) {
      const exit = previous.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(-10px)" },
        ],
        { duration: FADE_MS, easing: EASE, fill: "forwards" },
      );
      exit.finished.then(() => previous.remove()).catch(() => previous.remove());
    }

    if (event?.media) void this.#fillMedia(event, next, token);
  }

  #empty(): HTMLElement {
    const div = this.doc.createElement("div");
    div.className = "bt-message";
    div.innerHTML = "<p>Pick a point on the timeline.</p>";
    // Absolute, so it stacks with an outgoing article instead of pushing it.
    div.style.position = "absolute";
    div.style.inset = "0";
    return div;
  }

  #article(event: TimelineEvent): HTMLElement {
    const article = this.doc.createElement("article");
    article.className = "bt-article";
    article.style.position = "absolute";
    article.style.inset = "0";
    // Two columns or one, depending on whether there is anything to put in the
    // first. Set optimistically and withdrawn if the media turns out to be a
    // page rather than a picture — an empty half-width column beside the text
    // is worse than no column at all.
    article.dataset.media = event.media ? "true" : "false";

    const media = this.doc.createElement("div");
    media.className = "bt-media";
    media.hidden = !event.media;

    const words = this.doc.createElement("div");
    words.className = "bt-words";

    const date = this.doc.createElement("p");
    date.className = "bt-date";
    date.textContent = event.displayDate;

    const headline = this.doc.createElement("h3");
    headline.className = "bt-headline";
    headline.textContent = event.headline;

    const text = this.doc.createElement("div");
    text.className = "bt-text";
    // textContent throughout: a sheet is user-supplied content from a URL, and
    // nothing in it is ever interpreted as markup.
    text.textContent = event.text;

    words.append(date, headline, text);

    if (event.media) {
      const link = this.doc.createElement("a");
      link.className = "bt-source";
      link.href = event.media;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = sourceLabel(event);
      words.append(link);
    }

    article.append(media, words);
    return article;
  }

  /**
   * Fills the media pane, once the host has said what it can give.
   *
   * Anything that turns out not to be showable — a journal article, a dead
   * image link, an encyclopaedia entry with no picture — collapses the pane to
   * a single column rather than leaving a grey rectangle in half the width.
   */
  async #fillMedia(
    event: TimelineEvent,
    article: HTMLElement,
    token: number,
  ): Promise<void> {
    const pane = article.querySelector<HTMLDivElement>(".bt-media");
    if (!pane || !event.media) return;

    const collapse = () => {
      pane.hidden = true;
      article.dataset.media = "false";
    };

    let resolved;
    try {
      resolved = await resolveMedia(event.media);
    } catch {
      collapse();
      return;
    }

    // The reader has moved on; this answer is for an event nobody is looking at.
    if (token !== this.#token || !article.isConnected) return;

    if (resolved.type === "frame") {
      const frame = this.doc.createElement("iframe");
      frame.src = resolved.src;
      frame.title = event.mediaCaption || event.headline;
      frame.allow =
        "accelerometer; clipboard-write; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.loading = "lazy";
      // The embed is a third party. It gets to run scripts and be itself, and
      // nothing else: no access to this document, no top-level navigation.
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-presentation allow-popups",
      );
      pane.append(frame);
      return;
    }

    if (resolved.type === "image") {
      const img = this.doc.createElement("img");
      img.src = resolved.src;
      img.alt = event.mediaCaption || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.style.objectPosition = `50% ${this.crops[event.media] ?? 50}%`;
      // A link that no longer resolves is discovered here and nowhere else.
      img.addEventListener("error", collapse, { once: true });
      pane.append(img);
      return;
    }

    collapse();
  }
}
