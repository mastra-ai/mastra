import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { RestingPhaseLayout, WorkingPhaseLayout } from './PhaseConfigLayout';
import { PhaseMovesSkeleton } from './PhaseMoves';

const BAR = 'motion-reduce:before:animate-none';

function SwitchPlaceholder() {
  return <Skeleton aria-hidden className={cn('h-5 w-9 rounded-full', BAR)} />;
}

function MarkdownPlaceholder() {
  return (
    <div aria-hidden className="text-body-sm h-[calc(3lh-1.5rem)] leading-[1.4]">
      <SkeletonText line="text-body-sm" className={cn('w-3/5', BAR)} />
    </div>
  );
}

function InputPlaceholder() {
  return <Skeleton aria-hidden className={cn('h-control-md w-full rounded-full', BAR)} />;
}

export function PhaseConfigSkeleton({ working }: { working: boolean }) {
  return (
    <div role="status" aria-label="Loading phase">
      {working ? (
        <WorkingPhaseLayout
          label="Phase steps"
          autoStart={<SwitchPlaceholder />}
          instructions={<MarkdownPlaceholder />}
          goal={<MarkdownPlaceholder />}
          session={<InputPlaceholder />}
          skill={
            <div aria-hidden className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Skeleton className={cn('h-control-sm w-32 rounded-full', BAR)} />
                <Skeleton className={cn('ml-auto h-control-sm w-16 rounded-full', BAR)} />
              </div>
              <SkeletonText line="text-caption" className={cn('w-40 max-w-full', BAR)} />
            </div>
          }
          toolSwitch={() => <SwitchPlaceholder />}
          exitTool={<InputPlaceholder />}
          moves={<PhaseMovesSkeleton />}
        />
      ) : (
        <RestingPhaseLayout moves={<PhaseMovesSkeleton />} />
      )}
    </div>
  );
}
