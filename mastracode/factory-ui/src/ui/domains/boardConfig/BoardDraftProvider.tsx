import { createContext, useContext, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type { StoredBoardInfo } from '../../../api/types';
import { useBoardWritePending } from '../../../hooks/useBoardEditor';
import { draftOf } from './boardDraft';
import type { BoardDraft, RawRules } from './boardDraft';

interface StoredDraft {
  key: string;
  draft: BoardDraft;
  /** Rules typed as JSON, kept here so they outlive the phase page they were typed on. */
  rawRules: RawRules;
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
  // A save answers with the next revision, which starts a fresh draft: edits made while it's on its way would be lost.
  const locked = useBoardWritePending(factoryId, boardId);
  const key = draftKey(factoryId, boardId, board);
  const current = stored?.key === key ? stored : { key, draft: draftOf(board), rawRules: {} };
  const update = (change: (open: StoredDraft) => StoredDraft) =>
    setStored(latest => change(latest?.key === key ? latest : { key, draft: draftOf(board), rawRules: {} }));

  return {
    draft: current.draft,
    rawRules: current.rawRules,
    locked,
    setDraft: (change: (draft: BoardDraft) => BoardDraft) => update(open => ({ ...open, draft: change(open.draft) })),
    /** Unset text means the rule editor shows the rule builder again. */
    setRawRule: (ruleKey: string, text: string | undefined) =>
      update(open => {
        const { [ruleKey]: _dropped, ...rest } = open.rawRules;
        return { ...open, rawRules: text === undefined ? rest : { ...rest, [ruleKey]: text } };
      }),
    discard: () => setStored(undefined),
  };
}

/** The open draft, else the saved board: for places that show the board but don't edit it. */
export function useShownDraft(factoryId: string, boardId: string, board: StoredBoardInfo | undefined) {
  const stored = useContext(BoardDraftContext)?.[0];
  if (!board) return undefined;
  return stored?.key === draftKey(factoryId, boardId, board) ? stored.draft : draftOf(board);
}
