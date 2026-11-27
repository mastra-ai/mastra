import { LINK_LINE } from '../flow-links';
import { BOARD_HEADER } from './board-header';
import { INTAKE_CARD } from './intake-entry';
import { CARD_SIDE, RULES_SIDE, SESSION_SIDE } from './phase-flow';
import { PHASE_CARD } from './phase-node';
import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

const bar = 'motion-reduce:before:animate-none';
const PHASES = 3;

/** The board's name and description while the board loads, where the header will stand. */
export function BoardHeaderSkeleton() {
  return (
    <div aria-hidden className={BOARD_HEADER}>
      <SkeletonText line="text-display" className={cn('h-5 w-40', bar)} />
      <SkeletonText line="text-body" className={cn('w-72 max-w-full', bar)} />
    </div>
  );
}

/** The flow while the board loads: the intake card, then phase cards joined by their links, in the loaded columns. */
export function PhaseFlowSkeleton() {
  return (
    <div role="status" aria-label="Loading board" className="flex flex-col">
      <div aria-hidden className={cn(raisedSurfaceStyle, INTAKE_CARD)}>
        <div className="flex min-h-5.5 items-center gap-2">
          <IconArrowInbox className="size-icon-sm shrink-0 text-muted-foreground" />
          <SkeletonText line="text-card-title-strong" className={cn('w-44', bar)} />
        </div>
        <span className="pl-6">
          <SkeletonText line="text-caption" className={cn('w-56 max-w-full', bar)} />
        </span>
      </div>
      <ol aria-hidden className="flex flex-col">
        {Array.from({ length: PHASES }, (_, index) => (
          <li key={index} className="flex flex-col">
            {index > 0 && (
              <div className="flex h-8 gap-4">
                <span className={cn(RULES_SIDE, 'max-sm:order-last max-sm:w-auto')} />
                <span className={CARD_SIDE}>
                  <span className={LINK_LINE} />
                </span>
                <span className={SESSION_SIDE} />
              </div>
            )}
            <div className="flex gap-4 max-sm:flex-col">
              <span className={cn(RULES_SIDE, 'max-sm:hidden')} />
              <div className={cn(raisedSurfaceStyle, PHASE_CARD)}>
                <div className="flex items-center gap-2">
                  <Skeleton className={cn('size-4 shrink-0 rounded-full', bar)} />
                  <SkeletonText line="text-card-title-strong" className={cn('w-24', bar)} />
                </div>
                <SkeletonText line="text-body-sm" className={cn('w-40', bar)} />
              </div>
              <span className={SESSION_SIDE} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
