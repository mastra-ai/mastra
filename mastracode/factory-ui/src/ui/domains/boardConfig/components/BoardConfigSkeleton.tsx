import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import {
  BOARD_MAP_PHASE,
  BOARD_MAP_PHASE_BODY,
  BOARD_MAP_PHASE_TITLE,
  BOARD_MAP_PHASES,
  Step,
} from '@mastra/playground-ui/domains/factory';
import { IconArrowInbox } from '@mastra/playground-ui/icons/central/IconArrowInbox';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { cn } from '@mastra/playground-ui/utils/cn';

const bar = 'motion-reduce:before:animate-none';
const PHASES = 3;

function IconSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn(className, 'rounded-full', bar)} />;
}

export function BoardConfigHeaderSkeleton({ phase = false }: { phase?: boolean }) {
  return (
    <PageHeader aria-hidden>
      <PageHeader.Title className="gap-2.5">
        {phase && <IconSkeleton className="size-4 shrink-0" />}
        <SkeletonText line="text-heading" className={cn('h-5 w-32', bar)} />
      </PageHeader.Title>
      {phase && (
        <PageHeader.Meta beside>
          <Skeleton className={cn('h-5 w-16', bar)} />
        </PageHeader.Meta>
      )}
      <PageHeader.Description>
        <SkeletonText line="text-caption" className={cn('w-28', bar)} />
      </PageHeader.Description>
    </PageHeader>
  );
}

function PhaseColumnSkeleton() {
  return (
    <li className={BOARD_MAP_PHASE}>
      <div className={BOARD_MAP_PHASE_TITLE}>
        <IconSkeleton className="size-4 shrink-0" />
        <SkeletonText line="text-label" className={cn('w-20', bar)} />
      </div>
      <div className={BOARD_MAP_PHASE_BODY}>
        <ol className="flex flex-col">
          <Step label="In" icon={IconArrowInbox}>
            <SkeletonText line="text-caption" className={cn('w-20', bar)} />
          </Step>
          <Step label="Work" icon={IconSkeleton}>
            <SkeletonText line="text-caption" className={cn('w-28', bar)} />
          </Step>
          <Step label="Next" icon={IconArrowRight}>
            <span className="flex items-center gap-1.5">
              <IconSkeleton className="size-4 shrink-0" />
              <SkeletonText className={cn('w-20', bar)} />
            </span>
          </Step>
        </ol>
      </div>
    </li>
  );
}

export function BoardOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading board">
      <ol aria-hidden className={BOARD_MAP_PHASES}>
        {Array.from({ length: PHASES }, (_, index) => (
          <PhaseColumnSkeleton key={index} />
        ))}
      </ol>
    </div>
  );
}
