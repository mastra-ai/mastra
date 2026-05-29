import type { HeartbeatTrigger } from '@mastra/client-js';
import { DataList, DataListSkeleton, Tooltip, TooltipContent, TooltipTrigger, Txt } from '@mastra/playground-ui';
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

export interface HeartbeatTriggersListProps {
  triggers: HeartbeatTrigger[];
  isLoading: boolean;
  /** Owning agent id — used to link threaded heartbeat trigger rows to the agent thread chat. */
  agentId?: string;
  /** Thread id of the heartbeat (threaded only). When set, rows with a `runId` link to the chat. */
  threadId?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  setEndOfListElement?: (el: HTMLDivElement | null) => void;
}

// Columns: Run | Status | Started
const COLUMNS = 'auto auto 1fr';

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

export function HeartbeatTriggersList({
  triggers,
  isLoading,
  agentId,
  threadId,
  hasNextPage,
  isFetchingNextPage,
  setEndOfListElement,
}: HeartbeatTriggersListProps) {
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
    <DataList columns={COLUMNS} className="min-w-0" data-testid="heartbeat-triggers-list">
      <DataList.Top>
        <DataList.TopCell>Run</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Started</DataList.TopCell>
      </DataList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        const driftValue = formatDriftValue(driftMs);
        const startedTooltip = `Scheduled ${formatScheduleTimestamp(t.scheduledFireAt)} — published ${formatScheduleTimestamp(t.actualFireAt)} (drift ${driftValue})`;
        const isPublishFailure = t.outcome === 'failed';
        const absDrift = Math.abs(driftMs);
        const showDriftWarning = !isPublishFailure && absDrift > DRIFT_WARN_MIN_MS && absDrift <= DRIFT_WARN_MAX_MS;
        const rowKey = `${t.scheduleId}-${t.actualFireAt}-${t.runId ?? 'none'}`;
        const isLinked = Boolean(agentId && threadId && t.runId && !isPublishFailure);

        const runIdLabel = t.runId ? (
          <span
            className={
              isLinked
                ? 'text-accent1 font-mono text-ui-sm whitespace-nowrap'
                : 'text-neutral3 font-mono text-ui-sm whitespace-nowrap'
            }
            data-testid="heartbeat-trigger-run-id"
          >
            {t.runId}
          </span>
        ) : (
          <span className="text-neutral4">—</span>
        );

        const cells = (
          <>
            <DataList.Cell height="compact">{runIdLabel}</DataList.Cell>

            <DataList.Cell height="compact">
              <span className="inline-flex items-center gap-2">
                {isPublishFailure ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm text-accent2">
                        <AlertTriangleIcon size={14} />
                        failed
                      </span>
                    </TooltipTrigger>
                    {t.error ? <TooltipContent>{t.error}</TooltipContent> : null}
                  </Tooltip>
                ) : (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm text-accent1">
                    <CheckCircle2Icon size={14} />
                    fired
                  </span>
                )}
                {t.triggerKind === 'manual' ? (
                  <span
                    className="text-ui-xs text-neutral4 uppercase tracking-wide"
                    data-testid="heartbeat-trigger-manual-badge"
                  >
                    manual
                  </span>
                ) : null}
              </span>
            </DataList.Cell>

            <DataList.Cell height="compact">
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span title={startedTooltip} data-testid="heartbeat-trigger-fired-at">
                  {formatRelativeTime(t.actualFireAt)}
                </span>
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
          </>
        );

        return isLinked ? (
          <DataList.RowLink key={rowKey} to={paths.agentThreadLink(agentId!, threadId!, t.runId!)} LinkComponent={Link}>
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
