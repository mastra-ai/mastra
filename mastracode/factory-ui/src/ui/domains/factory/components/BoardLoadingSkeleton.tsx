import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useSearchParams } from 'react-router';

import { ButtonSkeleton } from '../../../ui/ButtonSkeleton';
import { boardLayoutFromParams } from '../boardLayout';
import { BoardColumnHeaderSkeleton, BoardColumnSkeleton } from './BoardColumn';
import { BOARD_COLUMNS_CLASS, BOARD_LIST_BODY_CLASS, BoardFrame } from './BoardFrame';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { BoardList, BoardListGroupSkeleton } from './BoardList';
import {
  BOARD_DEFAULT_VIEW_LABEL,
  BOARD_SEARCH_CLASS,
  BOARD_VIEW_TABS_CLASS,
  BoardViewControlsLayout,
} from './BoardViewControlsLayout';

const WORK_BOARD_PHASE_COUNT = 6;
const STAGE_PLACEHOLDERS = Array.from({ length: WORK_BOARD_PHASE_COUNT }, (_, index) => index);

export function BoardLoadingSkeleton() {
  const [params] = useSearchParams();
  const layout = boardLayoutFromParams(params);

  return (
    <BoardFrame
      role="status"
      aria-label="Loading boards"
      layout={layout}
      toolbar={
        <div aria-hidden className="flex w-full min-w-0">
          <BoardViewControlsLayout
            views={
              <>
                <div className={cn('flex flex-wrap items-center gap-1.5', BOARD_VIEW_TABS_CLASS)}>
                  <ButtonSkeleton variant="subtle" size="sm">
                    {BOARD_DEFAULT_VIEW_LABEL}
                  </ButtonSkeleton>
                  <Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-control-sm flex gap-0.5 rounded-full p-0.5 motion-reduce:before:animate-none">
                    <span className="aspect-square" />
                    <span className="aspect-square" />
                  </Skeleton>
                  <Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                </div>
              </>
            }
            search={
              <Skeleton
                className={cn('h-control-sm flex-1 rounded-full motion-reduce:before:animate-none', BOARD_SEARCH_CLASS)}
              />
            }
            aside={<Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />}
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
