import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { WorkflowCardDisplayStatus, WorkflowStepCardViewProps } from '../../types';
import { WorkflowTiming } from '../timing/workflow-timing';
import { getNodeIndicators } from '../workflow-card-badge-utils';
import { getWorkflowCardBadge } from '../workflow-card-kind';
import { WorkflowClock } from '../workflow-clock';
import { WorkflowTypeBadge } from '../workflow-type-badge';
import { ActivityWick } from '@/ds/components/Activity';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Shimmer } from '@/ds/components/Shimmer';
import { cn } from '@/utils/cn';

type ReportedStatus = NonNullable<WorkflowCardDisplayStatus>;

const statusLabels = {
  running: 'Running',
  success: 'Completed',
  failed: 'Failed',
  suspended: 'Needs input',
  waiting: 'Waiting',
  paused: 'Paused',
  skipped: 'Skipped',
  canceled: 'Canceled',
  tripwire: 'Tripwire blocked',
} satisfies Record<ReportedStatus, string>;

const statusLineClasses: Partial<Record<ReportedStatus, string>> = {
  success: 'after:bg-positive1',
  failed: 'after:bg-negative1',
  tripwire: 'after:bg-warning1',
  waiting: 'after:bg-accent5',
  paused: 'after:bg-neutral3',
  skipped: 'after:bg-neutral3',
};

const footerStatusClasses: Partial<Record<ReportedStatus, string>> = {
  success: 'text-positive1',
  failed: 'text-negative1',
  suspended: 'text-warning1',
  tripwire: 'text-warning1',
};

const suspendedWickStyle: CSSProperties & { '--belt-hue': string } = { '--belt-hue': 'var(--warning1)' };

export function WorkflowStepCardView(props: WorkflowStepCardViewProps) {
  const {
    label,
    description,
    displayStatus,
    stepKey,
    isSelected,
    isWaiting,
    isHovered,
    onHoverChange,
    onSelect,
    isForEach,
    foreachProgress,
    startedAt,
    endedAt,
    actionBar,
    body,
  } = props;
  const [expanded, setExpanded] = useState(props.initiallyOpen ?? false);
  const isRunning = displayStatus === 'running';
  const isSuspended = displayStatus === 'suspended';
  const reportedStatusLabel =
    displayStatus && Object.hasOwn(statusLabels, displayStatus) ? statusLabels[displayStatus] : undefined;
  const statusLabel = displayStatus ? (reportedStatusLabel ?? 'Status unavailable') : 'Not started';
  const kind = getWorkflowCardBadge(props);
  const capabilities = getNodeIndicators(props)
    .filter(indicator => indicator.id !== kind.indicator)
    .map(indicator => indicator.label.replace(/ step$/, ''));
  const hasActivity = isRunning || isSuspended;
  const isStacked = isForEach && !expanded;
  const isBodyExpanded = Boolean(body) && expanded;
  const Summary = onSelect ? 'button' : 'div';

  return (
    <div
      className={cn(
        'relative isolate w-[274px]',
        isBodyExpanded && 'w-172',
        isStacked &&
          'pb-3 before:absolute before:inset-x-1.5 before:top-2 before:bottom-1.5 before:-z-10 before:rounded-xl before:border before:border-border1 before:bg-surface3 after:absolute after:inset-x-3 after:top-3.5 after:bottom-0 after:-z-20 after:rounded-xl after:border after:border-border1 after:bg-surface3',
      )}
    >
      <Collapsible
        open={expanded}
        onOpenChange={setExpanded}
        className={cn(
          'relative rounded-xl border border-border1 bg-surface2 text-neutral5 shadow-panel transition-[border-color,box-shadow] [--card-radius:calc(var(--radius-xl)-2px)] motion-reduce:transition-none',
          'after:pointer-events-none after:absolute after:inset-x-4 after:-top-px after:h-px after:mask-x-from-76%',
          displayStatus && statusLineClasses[displayStatus],
          'has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-accent3',
          isSelected && 'outline-1 outline-offset-4 outline-neutral3',
          isBodyExpanded && 'border-dashed border-neutral3/40 shadow-none',
          isWaiting && 'border-accent3',
          isHovered && !isSelected && 'border-border2 shadow-dialog',
          hasActivity && 'border-transparent',
        )}
        data-workflow-node
        data-workflow-step-key={stepKey}
        data-workflow-step-status={displayStatus ?? 'idle'}
        data-workflow-step-active={isSelected || undefined}
        data-workflow-step-waiting={isWaiting || undefined}
        data-workflow-step-hovered={isHovered || undefined}
        data-testid={props.isNestedWorkflowStep ? 'workflow-nested-node' : 'workflow-default-node'}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <div className="m-0.5 overflow-hidden rounded-(--card-radius)">
          <Summary
            className={cn(
              'nodrag nopan flex w-full flex-col text-left',
              onSelect && 'group cursor-pointer focus-visible:outline-hidden',
            )}
            type={onSelect ? 'button' : undefined}
            aria-label={onSelect ? `Inspect ${label}` : undefined}
            aria-pressed={onSelect ? Boolean(isSelected) : undefined}
            onClick={onSelect}
          >
            <span className="group-hover:bg-surface4 flex items-start justify-between gap-2.5 rounded-(--card-radius) px-3.5 py-3">
              <span className="text-ui-sm text-neutral6 min-w-0 font-semibold wrap-anywhere" title={label}>
                <Shimmer active={isRunning}>{label}</Shimmer>
              </span>
              <WorkflowTypeBadge {...props} />
            </span>
            <span className="bg-surface3 flex flex-col gap-2 rounded-t-(--card-radius) px-3.5 py-3 empty:py-1.5">
              {description && <span className="text-ui-sm text-neutral3 wrap-anywhere">{description}</span>}
              <WorkflowTiming duration={props.duration} date={props.date} />
              {isWaiting && <span className="text-ui-xs text-accent3">Next step in debug</span>}
              {isForEach && foreachProgress && (
                <span className="text-ui-xs flex flex-col gap-2 py-1">
                  <span>
                    <strong>{foreachProgress.completedCount}</strong> of {foreachProgress.totalCount} items complete
                  </span>
                  {foreachProgress.totalCount > 0 ? (
                    <progress
                      className="bg-surface4 accent-positive1 [&::-moz-progress-bar]:bg-positive1 [&::-webkit-progress-bar]:bg-surface4 [&::-webkit-progress-value]:bg-positive1 h-1 w-full appearance-none border-0"
                      aria-label={`${label} completed items`}
                      value={foreachProgress.completedCount}
                      max={foreachProgress.totalCount}
                    />
                  ) : (
                    <span>No items to process</span>
                  )}
                </span>
              )}
              {capabilities.length > 0 && <span className="text-ui-xs text-neutral3">{capabilities.join(' · ')}</span>}
            </span>
          </Summary>
          <div
            className={cn(
              'nodrag nopan flex min-h-7 items-center justify-between gap-2 bg-surface3 px-3.5 pb-2.5 text-ui-xs text-neutral3',
              displayStatus && footerStatusClasses[displayStatus],
            )}
          >
            <span role="status" className={isRunning ? 'sr-only motion-reduce:not-sr-only' : undefined}>
              {statusLabel}
            </span>
            {startedAt !== undefined && (
              <span className="ml-auto">
                <WorkflowClock startedAt={startedAt} endedAt={endedAt} isRunning={isRunning} />
              </span>
            )}
            {actionBar}
          </div>

          {body && (
            <>
              <CollapsibleTrigger className="nodrag nopan border-border1 bg-surface3 text-ui-sm hover:bg-surface4 flex min-h-11 w-full items-center justify-between border-t px-3.5 py-2.5 focus-visible:shadow-none focus-visible:ring-0">
                <span>
                  {expanded ? 'Collapse' : 'Expand'} {isForEach ? 'loop' : 'workflow'}
                </span>
                <ChevronRight aria-hidden size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-border1 h-155 overflow-hidden border-t border-dashed">
                {body}
              </CollapsibleContent>
            </>
          )}
        </div>
        {hasActivity && (
          <ActivityWick
            status={isSuspended ? 'ready' : 'working'}
            aria-hidden
            className="before:hidden"
            style={isSuspended ? suspendedWickStyle : undefined}
          />
        )}
      </Collapsible>
    </div>
  );
}
