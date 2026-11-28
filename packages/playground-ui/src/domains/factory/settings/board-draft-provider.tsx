import { useState } from 'react';
import type { ReactNode } from 'react';

import { BoardDraftContext } from './use-board-draft';
import type { StoredDraft } from './use-board-draft';

/**
 * Holds the board draft for the board settings page, outside the canvas: the canvas gives way to an error while the
 * board fails to reload, and the edits must still be there once it's back.
 */
export function BoardDraftProvider({ children }: { children: ReactNode }) {
  const state = useState<StoredDraft | undefined>(undefined);
  return <BoardDraftContext.Provider value={state}>{children}</BoardDraftContext.Provider>;
}
