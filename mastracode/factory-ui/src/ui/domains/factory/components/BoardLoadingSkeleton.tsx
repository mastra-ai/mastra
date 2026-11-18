import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { boardPersonIdentity } from '../boardPeople';
import type { BoardParticipant } from '../boardPeople';
import { useBoardView } from '../hooks/useBoardView';
import { BoardColumnHeaderSkeleton, BoardColumnSkeleton } from './BoardColumn';
import { BOARD_COLUMNS_CLASS, BOARD_LIST_BODY_CLASS, BoardFrame } from './BoardFrame';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { BoardList, BoardListGroupSkeleton } from './BoardList';
import { BoardViewControls } from './BoardViewControls';

const WORK_BOARD_PHASE_COUNT = 6;
const STAGE_PLACEHOLDERS = Array.from({ length: WORK_BOARD_PHASE_COUNT }, (_, index) => index);
const NO_PARTICIPANTS: readonly BoardParticipant[] = [];
const NO_LABELS: readonly string[] = [];

export function BoardLoadingSkeleton() {
  const { factoryId = '', boardId = DEFAULT_BOARD_ID } = useParams<{ factoryId: string; boardId: string }>();
  const currentUserId = useFactoryAuth().data?.user?.userId;
  const view = useBoardView({
    factoryProjectId: factoryId,
    kind: boardId,
    reviewsPullRequests: false,
    currentUserId,
    personId: boardPersonIdentity(currentUserId, undefined),
  });
  const { layout } = view;

  return (
    <BoardFrame
      role="status"
      aria-label="Loading boards"
      layout={layout}
      toolbar={
        <div inert className="flex w-full min-w-0">
          <BoardViewControls
            factoryId={factoryId}
            boardId={boardId}
            reviewsPullRequests={false}
            view={view}
            participants={NO_PARTICIPANTS}
            availableLabels={NO_LABELS}
            currentUserId={currentUserId}
          />
        </div>
      }
      columnHeaders={STAGE_PLACEHOLDERS.map(index => (
        <BoardColumnHeaderSkeleton key={index} />
      ))}
    >
      {layout === 'board' ? (
        <div aria-hidden className={BOARD_COLUMNS_CLASS}>
          {STAGE_PLACEHOLDERS.map(index => (
            <BoardColumnSkeleton key={index}>
              <BoardItemsSkeleton label="Loading board items" layout="board" />
            </BoardColumnSkeleton>
          ))}
        </div>
      ) : (
        <div aria-hidden className={BOARD_LIST_BODY_CLASS}>
          <BoardList>
            {STAGE_PLACEHOLDERS.map(index => (
              <BoardListGroupSkeleton key={index}>
                <BoardItemsSkeleton label="Loading board items" layout="list" />
              </BoardListGroupSkeleton>
            ))}
          </BoardList>
        </div>
      )}
    </BoardFrame>
  );
}
