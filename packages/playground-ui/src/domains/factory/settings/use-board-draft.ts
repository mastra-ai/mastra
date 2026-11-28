import { useBoardWritePending } from '@mastra/react/hooks/factory';
import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { StoredBoardInfo, BoardDraft } from '..';
import { draftOf } from '..';

export interface StoredDraft {
  key: string;
  draft: BoardDraft;
}

export type DraftState = [StoredDraft | undefined, Dispatch<SetStateAction<StoredDraft | undefined>>];

export const BoardDraftContext = createContext<DraftState | undefined>(undefined);

/** A draft belongs to one revision of one board, so a save or a reload starts a fresh one. */
function draftKey(factoryId: string, boardId: string, board: StoredBoardInfo) {
  return `${factoryId}:${boardId}:${board.revision ?? 'code'}`;
}

export function useBoardDraft(factoryId: string, boardId: string, board: StoredBoardInfo) {
  const context = useContext(BoardDraftContext);
  if (!context) throw new Error('useBoardDraft must be used inside BoardDraftProvider');
  const [stored, setStored] = context;
  // A save answers with the next revision, which starts a fresh draft: edits made while it's on its way would be lost.
  const locked = useBoardWritePending(factoryId, boardId);
  const key = draftKey(factoryId, boardId, board);
  const current = stored?.key === key ? stored : { key, draft: draftOf(board) };
  const update = (change: (open: StoredDraft) => StoredDraft) =>
    setStored(latest => change(latest?.key === key ? latest : { key, draft: draftOf(board) }));

  return {
    draft: current.draft,
    locked,
    setDraft: (change: (draft: BoardDraft) => BoardDraft) => update(open => ({ ...open, draft: change(open.draft) })),
    discard: () => setStored(undefined),
  };
}
