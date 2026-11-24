/** How long a pointer waits before a tooltip, hover card or hover popover opens, and the only place those times are set. */
export const hoverOpenDelay = {
  /** A control that happens to have a tooltip: passing over it stays quiet, pausing on it explains it. */
  default: 300,
  /** The target exists to be hovered (an info icon, a chart point, a meter), so waiting only gets in the way. */
  instant: 0,
} as const;

export type HoverDelay = keyof typeof hoverOpenDelay;

/** How long a hover card stays after the pointer leaves. Instant cards sit side by side, so one makes way for the next. */
export const hoverCardCloseDelay = { default: 100, instant: 0 } as const satisfies Record<HoverDelay, number>;

/** For this long after a tooltip closes, the next one opens right away, as when moving along a toolbar. */
export const tooltipGroupTimeout = 400;

/** Numbers are the deprecated form, kept for published consumers. */
export function resolveHoverDelay(delay: HoverDelay | number) {
  return typeof delay === 'number' ? delay : hoverOpenDelay[delay];
}
