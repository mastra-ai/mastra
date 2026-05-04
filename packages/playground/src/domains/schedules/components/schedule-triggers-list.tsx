import type { ScheduleTriggerResponse } from '@mastra/client-js';
import {
  EntityList,
  EntityListSkeleton,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Txt,
} from '@mastra/playground-ui';
import { AlertTriangleIcon } from 'lucide-react';
import { formatScheduleTimestamp, formatRelativeTime } from '../utils/format';
import { WorkflowRunStatusInline } from './workflow-run-status-inline';
import { useLinkComponent } from '@/lib/framework';

export interface ScheduleTriggersListProps {
  triggers: ScheduleTriggerResponse[];
  isLoading: boolean;
  workflowId?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  setEndOfListElement?: (el: HTMLDivElement | null) => void;
}

const COLUMNS = 'auto auto auto auto 1fr';

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatDriftValue(driftMs: number): string {
  const abs = Math.abs(driftMs);
  const sign = driftMs < 0 ? '-' : '';
  if (abs < 1000) return `${sign}${abs}ms`;
  if (abs < 60_000) return `${sign}${(abs / 1000).toFixed(1)}s`;
  if (abs < 3_600_000) return `${sign}${(abs / 60_000).toFixed(1)}m`;
  return `${sign}${(abs / 3_600_000).toFixed(1)}h`;
}

// Warn when the scheduler published noticeably late (>30s) but skip cases where
// the row is almost certainly stale (paused schedule, long downtime, clock skew).
const DRIFT_WARN_MIN_MS = 30_000;
const DRIFT_WARN_MAX_MS = 5 * 60_000;

export function ScheduleTriggersList({
  triggers,
  isLoading,
  workflowId,
  hasNextPage,
  isFetchingNextPage,
  setEndOfListElement,
}: ScheduleTriggersListProps) {
  const { Link, paths } = useLinkComponent();

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  if (triggers.length === 0) {
    return (
      <Txt variant="ui-md" className="text-neutral4 p-4">
        No trigger history yet.
      </Txt>
    );
  }

  return (
    <EntityList columns={COLUMNS}>
      <EntityList.Top>
        <EntityList.TopCell>Run</EntityList.TopCell>
        <EntityList.TopCell>Status</EntityList.TopCell>
        <EntityList.TopCell>Started</EntityList.TopCell>
        <EntityList.TopCell>Duration</EntityList.TopCell>
        <EntityList.TopCell> </EntityList.TopCell>
      </EntityList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        const driftValue = formatDriftValue(driftMs);
        const startedTooltip = `Scheduled ${formatScheduleTimestamp(t.scheduledFireAt)} — published ${formatScheduleTimestamp(t.actualFireAt)} (drift ${driftValue})`;
        const isPublishFailure = t.status === 'failed';
        const errorMessage = isPublishFailure ? t.error : t.run?.error;
        const absDrift = Math.abs(driftMs);
        const showDriftWarning = !isPublishFailure && absDrift > DRIFT_WARN_MIN_MS && absDrift <= DRIFT_WARN_MAX_MS;

        const rowKey = `${t.scheduleId}-${t.runId}-${t.actualFireAt}`;
        const runIdLabel = (
          <span
            className={
              workflowId && !isPublishFailure
                ? 'text-accent1 font-mono text-ui-sm whitespace-nowrap'
                : 'text-neutral3 font-mono text-ui-sm whitespace-nowrap'
            }
          >
            {t.runId}
          </span>
        );

        const cells = (
          <>
            <EntityList.NameCell>{runIdLabel}</EntityList.NameCell>

            <EntityList.TextCell>
              <span className="inline-flex items-center gap-2">
                {isPublishFailure ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm text-accent2">
                    <AlertTriangleIcon size={14} />
                    publish failed
                  </span>
                ) : t.run ? (
                  <WorkflowRunStatusInline status={t.run.status} />
                ) : (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm text-neutral3">
                    pending
                  </span>
                )}
                {errorMessage ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-accent2 inline-flex">
                        <AlertTriangleIcon size={14} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{errorMessage}</TooltipContent>
                  </Tooltip>
                ) : null}
              </span>
            </EntityList.TextCell>

            <EntityList.TextCell>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span title={startedTooltip}>{formatRelativeTime(t.actualFireAt)}</span>
                {showDriftWarning ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-accent3 inline-flex">
                        <AlertTriangleIcon size={14} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Published {driftValue} after the scheduled fire time</TooltipContent>
                  </Tooltip>
                ) : null}
              </span>
            </EntityList.TextCell>

            <EntityList.TextCell>
              {t.run ? <span>{formatDuration(t.run.durationMs)}</span> : <span className="text-neutral4">—</span>}
            </EntityList.TextCell>
            <EntityList.TextCell> </EntityList.TextCell>
          </>
        );

        return workflowId && t.run && !isPublishFailure ? (
          <EntityList.RowLink key={rowKey} to={paths.workflowRunLink(workflowId, t.runId)} LinkComponent={Link}>
            {cells}
          </EntityList.RowLink>
        ) : (
          <EntityList.Row key={rowKey}>{cells}</EntityList.Row>
        );
      })}
      {setEndOfListElement ? (
        <div ref={setEndOfListElement} className="h-1 col-span-full">
          {isFetchingNextPage ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}
          {!hasNextPage && triggers.length > 0 ? (
            <Txt variant="ui-xs" className="text-neutral4 text-center py-4 block">
              All triggers loaded
            </Txt>
          ) : null}
        </div>
      ) : null}
    </EntityList>
  );
}
