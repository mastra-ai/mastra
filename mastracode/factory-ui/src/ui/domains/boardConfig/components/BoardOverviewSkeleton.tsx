import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { cn } from '@mastra/playground-ui/utils/cn';

import { unattended } from '../phaseSummary';
import { PHASE_COLUMN, PHASE_COLUMN_BODY, PHASE_COLUMN_HEAD, PHASE_MAP } from './BoardOverview';
import { RUNNER_CHIP } from './PhaseRunnerCard';
import { Step } from './PhaseTimeline';
import { STARTS_ROW } from './StartsToggle';

const BAR = 'motion-reduce:before:animate-none';

function CaptionPlaceholder({ width }: { width: string }) {
  return <SkeletonText line="text-caption" className={cn(width, BAR)} />;
}

function InitialPhaseSteps() {
  return (
    <>
      <Step label="In" icon={IconArrowInbox}>
        <CaptionPlaceholder width="w-32" />
        <CaptionPlaceholder width="w-28" />
      </Step>
      <Step label="Work" icon={unattended('resting').icon}>
        <CaptionPlaceholder width="w-24" />
      </Step>
    </>
  );
}

function WorkingPhaseSteps() {
  return (
    <>
      <Step label="In" icon={IconArrowInbox}>
        <CaptionPlaceholder width="w-32" />
      </Step>
      <Step label="Starts" icon={IconPlay}>
        <div className={STARTS_ROW}>
          <span className="min-w-0 flex-1">
            <CaptionPlaceholder width="w-24" />
          </span>
          <Skeleton className={cn('h-5 w-9 shrink-0 rounded-full', BAR)} />
        </div>
      </Step>
      <Step label="Work" icon={IconRobot}>
        <Skeleton className={cn(RUNNER_CHIP, 'w-28 border-transparent', BAR)}>
          <span>{'\u200b'}</span>
        </Skeleton>
      </Step>
    </>
  );
}

export function BoardOverviewSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Loading board">
      <ol aria-hidden className={PHASE_MAP}>
        {Array.from({ length: columns }, (_, index) => (
          <li key={index} className={PHASE_COLUMN}>
            <div className={PHASE_COLUMN_HEAD}>
              <Skeleton className={cn('size-4 shrink-0 rounded-full', BAR)} />
              <SkeletonText line="text-label" className={cn('w-24', BAR)} />
            </div>
            <div className={PHASE_COLUMN_BODY}>
              <ol className="flex flex-col">
                {index === 0 ? <InitialPhaseSteps /> : <WorkingPhaseSteps />}
                <Step label="Next" icon={IconArrowRight}>
                  <SkeletonText line="text-body-sm" className={cn('w-20', BAR)} />
                </Step>
              </ol>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
