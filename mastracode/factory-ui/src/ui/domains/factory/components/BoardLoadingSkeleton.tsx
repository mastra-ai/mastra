import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useSearchParams } from 'react-router';

import { boardLayoutFromParams } from '../boardLayout';
import { BOARD_VIEW_QUERY } from '../boardSavedViews';
import { BOARD_SEARCH_QUERY } from '../hooks/useBoardView';
import { BoardColumnHeaderSkeleton, BoardColumnSkeleton } from './BoardColumn';
import { BOARD_COLUMNS_CLASS, BOARD_LIST_BODY_CLASS, BoardFrame } from './BoardFrame';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { BoardList, BoardListGroupSkeleton } from './BoardList';
import { BoardPropertiesMenuPlaceholder } from './BoardPropertiesMenu';
import { BoardDefaultViewTabs, BoardLayoutToggle, BoardSearchInput } from './BoardViewControls';
import { BoardViewControlsLayout } from './BoardViewControlsLayout';

const WORK_BOARD_PHASE_COUNT = 6;
const STAGE_PLACEHOLDERS = Array.from({ length: WORK_BOARD_PHASE_COUNT }, (_, index) => index);

export function BoardLoadingSkeleton() {
  const [params] = useSearchParams();
  const layout = boardLayoutFromParams(params);
  const inView = params.has(BOARD_VIEW_QUERY);

  return (
    <BoardFrame
      role="status"
      aria-label="Loading boards"
      layout={layout}
      toolbar={
        <div inert className="flex w-full min-w-0">
          <BoardViewControlsLayout
            tabs={<BoardDefaultViewTabs selected={!inView} />}
            layoutToggle={<BoardLayoutToggle value={layout} />}
            properties={<BoardPropertiesMenuPlaceholder />}
            search={<BoardSearchInput value={params.get(BOARD_SEARCH_QUERY) ?? ''} inView={inView} />}
            aside={<Skeleton aria-hidden className="size-control-sm rounded-full motion-reduce:before:animate-none" />}
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
