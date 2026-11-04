import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useSearchParams } from 'react-router';

import { BOARD_SCROLL_SURFACE_CLASS, boardLayoutFromParams } from '../boardLayout';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { BoardViewControlsLayout } from './BoardViewControlsLayout';

/** The catalog loads before phase names exist; keep the board's frame and selected layout. */
export function BoardLoadingSkeleton() {
  const [params] = useSearchParams();
  const layout = boardLayoutFromParams(params);

  return (
    <div role="status" aria-label="Loading boards" className={BOARD_SCROLL_SURFACE_CLASS}>
      <div
        aria-hidden
        className={cn('flex min-h-full min-w-full flex-col gap-3', layout === 'board' ? 'w-max' : 'w-full')}
      >
        <div className="flex flex-col gap-3 pb-4">
          <div className="flex w-[100cqw] px-4 pt-4">
            <BoardViewControlsLayout
              views={
                <>
                  <Skeleton className="h-control-md w-24 rounded-full motion-reduce:before:animate-none" />
                  <Skeleton className="h-control-md w-20 rounded-full motion-reduce:before:animate-none" />
                </>
              }
              search={
                <Skeleton className="h-control-md w-48 max-w-full rounded-full motion-reduce:before:animate-none" />
              }
              aside={<Skeleton className="size-control-md rounded-full motion-reduce:before:animate-none" />}
            />
          </div>
          {layout === 'board' && (
            <div className="flex items-start gap-2 px-4 lg:gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex h-8 w-80 shrink-0 items-center gap-2">
                  <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
                  <Skeleton className="h-3.5 w-24 motion-reduce:before:animate-none" />
                  <Skeleton className="h-6 w-12 rounded-full motion-reduce:before:animate-none" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn('flex gap-2 px-4 pb-4 lg:gap-3', layout === 'list' && 'flex-col gap-4 lg:gap-4')}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn('flex flex-col', layout === 'board' && 'w-80 shrink-0')}>
              {layout === 'list' && (
                <div className="mb-1 flex min-h-9 items-center gap-2 px-3 py-1">
                  <Skeleton className="size-3.5 shrink-0 motion-reduce:before:animate-none" />
                  <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
                  <Skeleton className="h-3.5 w-24 motion-reduce:before:animate-none" />
                  <Skeleton className="h-4 w-5 motion-reduce:before:animate-none" />
                </div>
              )}
              <BoardItemsSkeleton label="Loading board items" layout={layout} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
