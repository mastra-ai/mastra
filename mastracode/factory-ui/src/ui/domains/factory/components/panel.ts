import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';

export const PANEL = `${raisedSurfaceStyle} rounded-xl`;

/** Rows are told apart by their hover pill, not by a rule between them. */
export const PANEL_ROW = 'flex items-center gap-3 rounded-lg px-3 py-2';

export const PANEL_ROW_LINK = `hover:bg-fill focus-visible:outline-accent1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ${PANEL_ROW}`;

export const TIMESTAMP = 'text-meta text-muted-foreground';
