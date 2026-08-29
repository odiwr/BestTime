import { BestTimeElement } from "./element";

export { BestTimeElement } from "./element";
export { Axis } from "./axis";
export { Detail } from "./detail";
export { STYLES } from "./styles";

// Re-exported so that a page using the script tag has the whole API without a
// second import — registering a media adapter is the commonest reason to reach
// past the element, and it should not require installing another package.
export * from "@besttime/core";

/**
 * Registers `<best-time>`.
 *
 * Called for you on import, which is what makes the script-tag build work with
 * no code at all. Guarded on both counts: `customElements` is absent during
 * server rendering, and defining a name twice throws — which happens the moment
 * a page loads the bundle and a framework's copy of it.
 */
export function define(name = "best-time"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(name)) return;
  customElements.define(name, BestTimeElement);
}

define();

declare global {
  interface HTMLElementTagNameMap {
    "best-time": BestTimeElement;
  }
}
