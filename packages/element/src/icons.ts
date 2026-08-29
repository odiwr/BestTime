/**
 * The five icons, inlined.
 *
 * An icon package is a dependency, a bundle, and a licence, for what amounts to
 * five paths. These are drawn on the same 24-unit grid and stroke weight as
 * Lucide's, which is where they came from in spirit — a plus, a minus, a
 * counter-clockwise arrow and two chevrons are not anyone's intellectual
 * property.
 */
const svg = (paths: string, width = 1.8) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = {
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>', 2),
  right: svg('<path d="M9 18l6-6-6-6"/>', 2),
} as const;
