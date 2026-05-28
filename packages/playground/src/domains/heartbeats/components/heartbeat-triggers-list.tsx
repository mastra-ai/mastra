import type { HeartbeatTrigger } from '@mastra/client-js';
import { DataList, DataListSkeleton, Tooltip, TooltipContent, TooltipTrigger, Txt } from '@mastra/playground-ui';
import { AlertTriangleIcon } from 'lucide-react';
import { WorkflowRunStatusInline } from '@/domains/schedules/components/workflow-run-status-inline';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';

export interface HeartbeatTriggersListProps {
  triggers: HeartbeatTrigger[];
  isLoading: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  setEndOfListElement?: (el: HTMLDivElement | null) => void;
}

// Columns: Fired at | Status | Started | Duration | Error
const COLUMNS = 'auto auto auto auto 1fr';

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Triggers list for the heartbeat detail page. Mirrors `ScheduleTriggersList`
 * but replaces the `runId` column with a human-readable `actualFireAt`
 * timestamp ("Fired at"). Rows are non-navigable because the underlying
 * `__mastra_heartbeat__` workflow is hidden from the public `/workflows`
 * surface.
 */
export function HeartbeatTriggersList({
  triggers,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  setEndOfListElement,
}: HeartbeatTriggersListProps) {
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
    <DataList columns={COLUMNS} className="min-w-0" data-testid="heartbeat-triggers-list">
      <DataList.Top>
        <DataList.TopCell>Fired at</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Started</DataList.TopCell>
        <DataList.TopCell>Duration</DataList.TopCell>
        <DataList.TopCell>Error</DataList.TopCell>
      </DataList.Top>

      {triggers.map(t => {
        const isPublishFailure = t.outcome === 'failed';
        const errorMessage = isPublishFailure ? t.error : t.run?.error;
        const rowKey = `${t.scheduleId}-${t.actualFireAt}-${t.runId ?? 'none'}`;

        return (
          <DataList.RowStatic key={rowKey}>
            <DataList.Cell height="compact">
              <span
                className="text-ui-sm whitespace-nowrap"
                title={formatScheduleTimestamp(t.actualFireAt)}
                data-testid="heartbeat-trigger-fired-at"
              >
                {formatRelativeTime(t.actualFireAt)}
              </span>
            </DataList.Cell>

            <DataList.Cell height="compact">
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
              </span>
            </DataList.Cell>

            <DataList.Cell height="compact">
              {t.run?.startedAt ? (
                <span className="text-ui-sm whitespace-nowrap" title={formatScheduleTimestamp(t.run.startedAt)}>
                  {formatRelativeTime(t.run.startedAt)}
                </span>
              ) : (
                <span className="text-neutral4">—</span>
              )}
            </DataList.Cell>

            <DataList.Cell height="compact">
              {t.run ? (
                <span className="text-ui-sm">{formatDuration(t.run.durationMs)}</span>
              ) : (
                <span className="text-neutral4">—</span>
              )}
            </DataList.Cell>

            <DataList.Cell height="compact">
              {errorMessage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm text-accent2 max-w-full">
                      <AlertTriangleIcon size={14} className="shrink-0" />
                      <span className="truncate">{errorMessage}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{errorMessage}</TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-neutral4">—</span>
              )}
            </DataList.Cell>
          </DataList.RowStatic>
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
