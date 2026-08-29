"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { BestTimeElement } from "besttime";
import type { ScaleOptions, TimelineEvent } from "@besttime/core";

export type { TimelineEvent, ScaleOptions } from "@besttime/core";
export type { BestTimeElement } from "besttime";

/**
 * `<BestTime />`.
 *
 * React 19 renders custom elements natively — attributes, properties and events
 * all pass through without a ref — so this wrapper is deliberately thin. It
 * exists for two things React still will not do for you:
 *
 *  1. **Types.** Declaring `best-time` as an intrinsic JSX element is fiddly
 *     enough per-project that a component is kinder than a `.d.ts` snippet in
 *     a README.
 *  2. **Server rendering.** `customElements` does not exist on a server, and
 *     importing the element package at module scope in a React Server
 *     Component is an immediate crash. The import here is deferred to an
 *     effect, so the component is safe to drop into a Next.js app without a
 *     dynamic import wrapping it.
 */

export type BestTimeProps = {
  /** A published Google Sheet, a CSV, or a JSON file. */
  src?: string;

  /** Events supplied directly, instead of `src`. */
  events?: TimelineEvent[];

  /** Any CSS colour. Sets `--bt-accent`. */
  accent?: string;

  /** Forces light or dark. Omit to follow the reader's system setting. */
  theme?: "light" | "dark";

  /** Total height. A bare number is pixels. */
  height?: number | string;

  /** Height of the axis strip within that. */
  axisHeight?: number | string;

  /**
   * The latest year any span may reach. Defaults to the current year, which
   * keeps a history from reserving half its width for empty future. Pass
   * `Infinity` for a roadmap.
   */
  maxYear?: number;

  /** Set false to draw true distances and never collapse an empty stretch. */
  collapseGaps?: boolean;

  /** Set false to stop remembering which event was last open. */
  remember?: boolean;

  /** Per-picture framing, keyed by media URL. 0 is the top, 100 the bottom. */
  crops?: Record<string, number>;

  /** Overrides for the axis derivation. Rarely needed. */
  scaleOptions?: ScaleOptions;

  onSelect?: (event: TimelineEvent) => void;
  onLoad?: (events: TimelineEvent[]) => void;
  onError?: (error: unknown) => void;

  className?: string;
  style?: CSSProperties;
};

export function BestTime({
  src,
  events,
  accent,
  theme,
  height,
  axisHeight,
  maxYear,
  collapseGaps,
  remember,
  crops,
  scaleOptions,
  onSelect,
  onLoad,
  onError,
  className,
  style,
}: BestTimeProps) {
  const ref = useRef<BestTimeElement | null>(null);

  // Registers the element in the browser only. A bare `import "besttime"` at
  // the top of this file would run during server rendering and throw.
  useEffect(() => {
    void import("besttime");
  }, []);

  // Handlers live in a ref so that an inline arrow function — which is what
  // everybody writes — does not tear the listener down and rebuild it on every
  // render of the parent.
  const handlers = useRef({ onSelect, onLoad, onError });
  handlers.current = { onSelect, onLoad, onError };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const select = (e: Event) =>
      handlers.current.onSelect?.((e as CustomEvent).detail.event);
    const load = (e: Event) =>
      handlers.current.onLoad?.((e as CustomEvent).detail.events);
    const fail = (e: Event) =>
      handlers.current.onError?.((e as CustomEvent).detail.error);

    element.addEventListener("besttime:select", select);
    element.addEventListener("besttime:load", load);
    element.addEventListener("besttime:error", fail);

    return () => {
      element.removeEventListener("besttime:select", select);
      element.removeEventListener("besttime:load", load);
      element.removeEventListener("besttime:error", fail);
    };
  }, []);

  // Properties rather than attributes, because these are objects and arrays.
  // Guarded on the element having upgraded: before the dynamic import lands,
  // `ref.current` is an unknown element and assigning to it would be shadowed
  // by the class field once it does.
  useEffect(() => {
    const element = ref.current;
    if (!element || !crops) return;
    if ("crops" in element) element.crops = crops;
  }, [crops]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !scaleOptions) return;
    if ("scaleOptions" in element) element.scaleOptions = scaleOptions;
  }, [scaleOptions]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !events) return;
    if ("events" in element) element.events = events;
  }, [events]);

  const size = (value: number | string | undefined) =>
    typeof value === "number" ? `${value}px` : value;

  return (
    <best-time
      ref={ref}
      src={src}
      accent={accent}
      theme={theme}
      height={size(height)}
      axis-height={size(axisHeight)}
      max-year={maxYear === Infinity ? "none" : maxYear?.toString()}
      collapse-gaps={collapseGaps === false ? "false" : undefined}
      remember={remember === false ? "false" : undefined}
      class={className}
      style={style}
    />
  );
}

// Inline `import(...)` types throughout: inside a `declare module "react"`
// augmentation, a name imported at the top of this file counts as private and
// cannot appear in the emitted declarations.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "best-time": {
        ref?: import("react").Ref<import("besttime").BestTimeElement | null>;
        src?: string;
        accent?: string;
        theme?: string;
        height?: string;
        "axis-height"?: string;
        "max-year"?: string;
        "collapse-gaps"?: string;
        remember?: string;
        class?: string;
        style?: import("react").CSSProperties;
      };
    }
  }
}
