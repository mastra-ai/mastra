import { workBoard } from '@mastra/factory/boards';
import { boardDefinitionOf, codeBehaviourOf } from '@mastra/factory/boards/stored-board';

import type { StoredBoardInfo, StoredBoardResponse } from '../../../../../api/types';

/** The project's stored copy of the built-in Work board, as `GET …/boards/work` returns it. */
export function storedWorkBoard(board: Partial<StoredBoardInfo> = {}, canEdit = true): StoredBoardResponse {
  const { description, ...definition } = boardDefinitionOf(workBoard);
  return {
    board: {
      ...definition,
      description: description ?? null,
      revision: 1,
      source: 'builtin',
      editable: true,
      codeBehaviour: codeBehaviourOf(workBoard),
      problems: [],
      ...board,
    },
    canEdit,
  };
}
