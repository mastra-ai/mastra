import { BoardHeader as SharedBoardHeader } from '@mastra/playground-ui/domains/factory';

import type { StoredBoardInfo } from '../../../../api/types';
import type { BoardDraft } from '../../boardConfig/boardDraft';
import type { BoardActionWrites } from './BoardActions';

interface BoardHeaderProps {
  board: StoredBoardInfo;
  draft: BoardDraft;
  /** Whether the name and description stay as they are, including while a write holds the board still. */
  readOnly: boolean;
  /** Whether this user may change the board at all: reset it, delete it, edit it. */
  manageable: boolean;
  /** The write in flight holds the board still. */
  locked: boolean;
  writes: BoardActionWrites;
  /** The project's rules didn't load, so the canvas shows none. */
  rulesFailed: boolean;
  onChange: (patch: Pick<BoardDraft, 'name'> | Pick<BoardDraft, 'description'>) => void;
}

/** The board's header, its reset and delete sent with the revision the board was read at. */
export function BoardHeader({
  board,
  draft,
  readOnly,
  manageable,
  locked,
  writes,
  rulesFailed,
  onChange,
}: BoardHeaderProps) {
  const { reset, remove } = writes;
  return (
    <SharedBoardHeader
      name={draft.name}
      description={draft.description}
      readOnly={readOnly}
      manageable={manageable}
      editable={board.editable}
      problems={board.problems}
      rulesFailed={rulesFailed}
      actions={{
        boardName: board.name,
        resettable: board.source !== 'stored',
        deletable: board.source !== 'builtin',
        busy: reset.isPending || remove.isPending,
        disabled: locked,
        onReset: () => reset.mutate(board.revision ?? 0),
        onDelete: () => remove.mutate(board.revision ?? 0),
      }}
      errors={{ resetError: reset.error?.reasons, deleteError: remove.error?.reasons }}
      onChange={onChange}
    />
  );
}
