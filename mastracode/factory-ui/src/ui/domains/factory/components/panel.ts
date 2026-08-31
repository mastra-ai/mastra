/** One card shape for every Factory surface, soft enough that a page of them still reads as one plane. */
export const SOFT_SHADOW = 'shadow-[0_1px_2px_-1px_oklch(0%_0_0deg/8%),0_10px_26px_-18px_oklch(0%_0_0deg/16%)]';

export const PANEL = `border-border1 bg-surface3 rounded-xl border ${SOFT_SHADOW}`;

/** Rows are told apart by their hover pill, not by a rule between them. */
export const PANEL_ROW = 'flex items-center gap-3 rounded-lg px-3 py-2';

export const PANEL_ROW_LINK = `hover:bg-surface4 focus-visible:outline-accent1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ${PANEL_ROW}`;

export const TIMESTAMP = 'text-ui-xs text-neutral6/50 font-medium tracking-tight';
