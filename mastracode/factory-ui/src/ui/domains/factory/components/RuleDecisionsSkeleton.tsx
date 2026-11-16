import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { DayHeading, RailRow, RAIL_LIST, RAIL_ROW_BODY } from './Timeline';

export function RuleDecisionsSkeleton() {
  return (
    <div role="status" aria-label="Loading rule decisions">
      <div aria-hidden className="flex flex-col gap-5 pt-2 pr-1">
        <DayHeading>
          <SkeletonText line="text-meta" className="w-16 motion-reduce:before:animate-none" />
        </DayHeading>
        <ul className={RAIL_LIST}>
          {Array.from({ length: 4 }, (_, index) => (
            <RailRow
              key={index}
              connected={index < 3}
              mark={<Skeleton className="size-3.5 rounded-full motion-reduce:before:animate-none" />}
            >
              <div className={cn('flex min-h-7 min-w-0 items-center gap-2 py-0.5', RAIL_ROW_BODY)}>
                <SkeletonText line="text-column" className="w-32 motion-reduce:before:animate-none" />
                <Skeleton className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
                <SkeletonText line="text-meta" className="ml-auto w-12 motion-reduce:before:animate-none" />
              </div>
            </RailRow>
          ))}
        </ul>
      </div>
    </div>
  );
}
