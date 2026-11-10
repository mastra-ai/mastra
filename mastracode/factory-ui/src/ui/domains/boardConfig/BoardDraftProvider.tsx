import { createContext, useContext, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type { StoredBoardInfo } from '../../../api/types';
import { draftOf } from './boardDraft';
import type { BoardDraft } from './boardDraft';

interface StoredDraft {
  key: string;
  draft: BoardDraft;
}

type DraftState = [StoredDraft | undefined, Dispatch<SetStateAction<StoredDraft | undefined>>];

const BoardDraftContext = createContext<DraftState | undefined>(undefined);

/** A draft belongs to one revision of one board, so a save or a reload starts a fresh one. */
function draftKey(factoryId: string, boardId: string, board: StoredBoardInfo) {
  return `${factoryId}:${boardId}:${board.revision ?? 'code'}`;
}

/**
 * Holds the board draft above the sidebar and the page, so the phase list shows unsaved names and order while the
 * page edits them.
 */
export function BoardDraftProvider({ children }: { children: ReactNode }) {
  const state = useState<StoredDraft | undefined>(undefined);
  return <BoardDraftContext.Provider value={state}>{children}</BoardDraftContext.Provider>;
}

export function useBoardDraft(factoryId: string, boardId: string, board: StoredBoardInfo) {
  const context = useContext(BoardDraftContext);
  if (!context) throw new Error('useBoardDraft must be used inside BoardDraftProvider');
  const [stored, setStored] = context;
  const key = draftKey(factoryId, boardId, board);
  const draft = stored?.key === key ? stored.draft : draftOf(board);

  return {
    draft,
    setDraft: (update: (current: BoardDraft) => BoardDraft) =>
      setStored(current => ({ key, draft: update(current?.key === key ? current.draft : draftOf(board)) })),
    discard: () => setStored(undefined),
  };
}

/** The draft's board name while one is open, else the saved one: for places that show the board but don't edit it. */
export function useBoardDraftName(factoryId: string, boardId: string, board: StoredBoardInfo | undefined) {
  const stored = useContext(BoardDraftContext)?.[0];
  if (!board) return undefined;
  return stored?.key === draftKey(factoryId, boardId, board) ? stored.draft.name : board.name;
}
