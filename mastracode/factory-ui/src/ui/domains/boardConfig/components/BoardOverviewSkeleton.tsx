import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { cn } from '@mastra/playground-ui/utils/cn';

import { unattended } from '../phaseSummary';
import { PhaseColumn, PhaseMap } from './BoardOverview';
import { PhaseRunnerCardSkeleton } from './PhaseRunnerCard';
import { WalkthroughSteps } from './PhaseWalkthrough';
import { StartsToggleSkeleton } from './StartsToggle';

const BAR = 'motion-reduce:before:animate-none';

function CaptionPlaceholder({ width }: { width: string }) {
  return <SkeletonText line="text-caption" className={cn(width, BAR)} />;
}

export function BoardOverviewSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Loading board">
      <PhaseMap aria-hidden>
        {Array.from({ length: columns }, (_, index) => (
          <PhaseColumn
            key={index}
            head={
              <>
                <Skeleton className={cn('size-4 shrink-0 rounded-full', BAR)} />
                <SkeletonText line="text-label" className={cn('w-24', BAR)} />
              </>
            }
          >
            {index === 0 ? (
              <WalkthroughSteps
                arrivals={
                  <>
                    <CaptionPlaceholder width="w-32" />
                    <CaptionPlaceholder width="w-28" />
                  </>
                }
                workIcon={unattended('resting').icon}
                work={<CaptionPlaceholder width="w-24" />}
                next={<SkeletonText line="text-body-sm" className={cn('w-20', BAR)} />}
              />
            ) : (
              <WalkthroughSteps
                arrivals={<CaptionPlaceholder width="w-32" />}
                starts={<StartsToggleSkeleton />}
                workIcon={IconRobot}
                work={<PhaseRunnerCardSkeleton />}
                next={<SkeletonText line="text-body-sm" className={cn('w-20', BAR)} />}
              />
            )}
          </PhaseColumn>
        ))}
      </PhaseMap>
    </div>
  );
}
