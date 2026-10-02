import { z } from 'zod';

import { BOARD_LAYOUTS, DEFAULT_BOARD_LAYOUT } from './boardLayout';
import { BOARD_SORTS } from './boardOrder';
import { DEFAULT_BOARD_SORT } from './boardSort';

/** Query parameter holding the selected saved view, so a refresh or a shared link keeps it. */
export const BOARD_VIEW_QUERY = 'view';

/** A sort or layout the board no longer offers falls back to the default instead of dropping the view. */
export const boardViewSettingsSchema = z.object({
  sort: z.enum(BOARD_SORTS).catch(DEFAULT_BOARD_SORT),
  layout: z.enum(BOARD_LAYOUTS).catch(DEFAULT_BOARD_LAYOUT),
});

export type BoardViewSettings = z.infer<typeof boardViewSettingsSchema>;

/** One list of views per factory board; the `mastracode` prefix lets sign-out clear it. */
export function savedBoardViewsStorageKey(factoryId: string, boardId: string): string {
  return `mastracode.savedViews:${factoryId}:${boardId}`;
}
