import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';

export const PANEL = `${raisedSurfaceStyle} rounded-xl`;

/** Rows are told apart by their hover pill, not by a rule between them. */
export const PANEL_ROW = 'flex items-center gap-3 rounded-lg px-3 py-2';

export const PANEL_ROW_LINK = `hover:bg-fill transition-colors ${focusRingInset} ${PANEL_ROW}`;
