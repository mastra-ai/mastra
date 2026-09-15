import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowCardDisplayStatus, WorkflowStepCardViewProps } from '../../types';
import { WorkflowTiming } from '../timing/workflow-timing';
import { getNodeIndicators } from '../workflow-card-badge-utils';
import { getWorkflowCardBadge } from '../workflow-card-kind';
import { WorkflowClock } from '../workflow-clock';
import { WorkflowTypeBadge } from '../workflow-type-badge';
import { ActivityWick } from '@/ds/components/Activity';
import { Button } from '@/ds/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Shimmer } from '@/ds/components/Shimmer';
import './workflow-card.css';

const statusLabels = {
  running: 'Running',
  success: 'Completed',
  failed: 'Failed',
  suspended: 'Needs input',
  waiting: 'Waiting',
  paused: 'Paused',
  skipped: 'Skipped',
  tripwire: 'Tripwire blocked',
} satisfies Record<NonNullable<WorkflowCardDisplayStatus>, string>;

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
    onOpenBody,
  } = props;
  const [expanded, setExpanded] = useState(props.initiallyOpen ?? false);
  const titleShimmer = displayStatus === 'running';
  const reportedStatusLabel =
    displayStatus && Object.hasOwn(statusLabels, displayStatus) ? statusLabels[displayStatus] : undefined;
  const statusLabel = displayStatus ? (reportedStatusLabel ?? 'Status unavailable') : 'Not started';
  const kind = getWorkflowCardBadge(props);
  const capabilities = getNodeIndicators(props)
    .filter(indicator => indicator.id !== kind.indicator)
    .map(indicator => indicator.label.replace(/ step$/, ''));
  const activityStatus = displayStatus === 'suspended' ? 'ready' : 'working';
  const hasActivity = displayStatus === 'running' || displayStatus === 'suspended';
  const hasInteraction = Boolean(onSelect || body);
  const hasGraphBody = Boolean(body && props.bodyLayout === 'graph');
  const Summary = hasInteraction ? 'button' : 'div';

  return (
    <div
      className="workflow-card-stack"
      data-stacked={(isForEach && !expanded) || undefined}
      data-inline-expanded={(hasGraphBody && expanded) || undefined}
    >
      <Collapsible
        open={expanded}
        onOpenChange={open => {
          setExpanded(open);
          if (open && !hasGraphBody) onSelect?.();
        }}
        className="workflow-step-card"
        data-workflow-node
        data-workflow-step-key={stepKey}
        data-workflow-step-status={displayStatus ?? 'idle'}
        data-workflow-step-active={isSelected || undefined}
        data-workflow-step-waiting={isWaiting || undefined}
        data-workflow-step-hovered={isHovered || undefined}
        data-title-shimmer={titleShimmer || undefined}
        data-testid={props.isNestedWorkflowStep ? 'workflow-nested-node' : 'workflow-default-node'}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <div className="workflow-card-clip">
          <Summary
            className="workflow-card-trigger nodrag nopan"
            type={hasInteraction ? 'button' : undefined}
            aria-label={hasInteraction ? `Inspect ${label}` : undefined}
            aria-pressed={onSelect && !hasGraphBody ? Boolean(isSelected) : undefined}
            aria-expanded={body ? expanded : undefined}
            onClick={
              hasInteraction
                ? () => {
                    if (!hasGraphBody) onSelect?.();
                    if (body) setExpanded(!expanded);
                  }
                : undefined
            }
          >
            <span className="workflow-card-header">
              <span className="workflow-card-heading">
                <span className="workflow-card-title" title={label}>
                  <Shimmer active={titleShimmer}>{label}</Shimmer>
                </span>
                <WorkflowTypeBadge {...props} />
              </span>
            </span>
            <span className="workflow-card-content">
              {description && <span className="workflow-card-description">{description}</span>}
              <WorkflowTiming duration={props.duration} date={props.date} />
              {isWaiting && <span className="workflow-card-debug">Next step in debug</span>}
              {isForEach && foreachProgress && (
                <span className="workflow-card-progress">
                  <span>
                    <strong>{foreachProgress.completedCount}</strong> of {foreachProgress.totalCount} items complete
                  </span>
                  {foreachProgress.totalCount > 0 ? (
                    <progress
                      aria-label={`${label} completed items`}
                      value={foreachProgress.completedCount}
                      max={foreachProgress.totalCount}
                    />
                  ) : (
                    <span>No items to process</span>
                  )}
                </span>
              )}
              {capabilities.length > 0 && (
                <span className="workflow-card-capabilities">{capabilities.join(' · ')}</span>
              )}
            </span>
          </Summary>
          <div className="workflow-card-footer nodrag nopan">
            <span className={titleShimmer ? 'workflow-running-label' : undefined}>{statusLabel}</span>
            {startedAt !== undefined && (
              <span className="workflow-card-elapsed">
                <WorkflowClock startedAt={startedAt} endedAt={endedAt} isRunning={displayStatus === 'running'} />
              </span>
            )}
            {actionBar}
          </div>

          {body && (
            <>
              <CollapsibleTrigger className="workflow-card-disclosure nodrag nopan">
                <span>
                  {expanded ? 'Collapse' : 'Expand'} {isForEach ? 'loop' : 'workflow'}
                </span>
                <span className="workflow-card-chevron">
                  <ChevronDown aria-hidden size={14} />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className={hasGraphBody ? 'workflow-card-inline-body' : 'workflow-card-body'}>
                {body}
                {onOpenBody && !hasGraphBody && (
                  <Button variant="ghost" onClick={onOpenBody}>
                    Open full workflow
                  </Button>
                )}
              </CollapsibleContent>
            </>
          )}
        </div>
        {hasActivity && <ActivityWick status={activityStatus} className="workflow-card-wick" aria-hidden />}
      </Collapsible>
    </div>
  );
}
