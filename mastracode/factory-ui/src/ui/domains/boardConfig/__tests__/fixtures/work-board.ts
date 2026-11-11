import { workBoard } from '@mastra/factory/boards';
import { codeBehaviourOf } from '@mastra/factory/boards/stored-board';
import { workSeedWithTriage } from '@mastra/factory/boards/work-seeds';

import type { StoredBoardInfo, StoredBoardResponse } from '../../../../../api/types';

/**
 * The project's stored copy of the built-in Work board, as `GET …/boards/work` returns it for a
 * project stored before new projects' Work dropped Triage.
 */
export function storedWorkBoard(board: Partial<StoredBoardInfo> = {}, canEdit = true): StoredBoardResponse {
  const { description, ...definition } = workSeedWithTriage();
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
