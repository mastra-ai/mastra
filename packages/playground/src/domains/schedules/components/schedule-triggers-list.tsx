import type { ScheduleTriggerResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (triggers.length === 0) {
    return (
      <Txt variant="ui-md" className="text-neutral4 p-4">
        No trigger history yet.
      </Txt>
    );
  }

  return (
    <DataList columns={COLUMNS} className="min-w-0">
      <DataList.Top>
        <DataList.TopCell>Run</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Started</DataList.TopCell>
        <DataList.TopCell>Duration</DataList.TopCell>
        <DataList.TopCell> </DataList.TopCell>
      </DataList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        const driftValue = formatDriftValue(driftMs);
        const startedTooltip = `Scheduled ${formatScheduleTimestamp(t.scheduledFireAt)} — published ${formatScheduleTimestamp(t.actualFireAt)} (drift ${driftValue})`;
        const isPublishFailure = t.outcome === 'failed';
        const errorMessage = isPublishFailure ? t.error : t.run?.error;
        const absDrift = Math.abs(driftMs);
        const showDriftWarning = !isPublishFailure && absDrift > DRIFT_WARN_MIN_MS && absDrift <= DRIFT_WARN_MAX_MS;

        const rowKey = `${t.scheduleId}-${t.runId}-${t.actualFireAt}`;
        const isLinked = Boolean(workflowId && t.runId && !isPublishFailure);
        const runIdLabel = (
          <span
            className={
              isLinked
                ? 'text-accent1 text-ui-sm font-mono whitespace-nowrap'
                : 'text-neutral3 text-ui-sm font-mono whitespace-nowrap'
            }
          >
            {t.runId}
          </span>
        );

        const cells = (
          <>
            <DataList.Cell height="compact">{runIdLabel}</DataList.Cell>

            <DataList.Cell height="compact">
              <span className="inline-flex items-center gap-2">
                {isPublishFailure ? (
                  <span className="text-ui-sm text-accent2 inline-flex items-center gap-1.5 whitespace-nowrap">
                    <AlertTriangleIcon size={14} />
                    publish failed
                  </span>
                ) : t.run ? (
                  <WorkflowRunStatusInline status={t.run.status} />
                ) : (
                  <span className="text-ui-sm text-neutral3 inline-flex items-center gap-1.5 whitespace-nowrap">
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
            </DataList.Cell>

            <DataList.Cell height="compact">
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
            </DataList.Cell>

            <DataList.Cell height="compact">
              {t.run ? <span>{formatDuration(t.run.durationMs)}</span> : <span className="text-neutral4">—</span>}
            </DataList.Cell>
            <DataList.Cell height="compact"> </DataList.Cell>
          </>
        );

        return isLinked ? (
          <DataList.RowLink key={rowKey} to={paths.workflowRunLink(workflowId!, t.runId!)} LinkComponent={Link}>
            {cells}
          </DataList.RowLink>
        ) : (
          <DataList.RowStatic key={rowKey}>{cells}</DataList.RowStatic>
        );
      })}
      <DataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </DataList>
  );
}
