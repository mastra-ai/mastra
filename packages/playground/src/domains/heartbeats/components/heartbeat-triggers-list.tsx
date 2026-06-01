import type { HeartbeatTrigger, ScheduleTriggerOutcome } from '@mastra/client-js';
import { DataList, DataListSkeleton, Tooltip, TooltipContent, TooltipTrigger, Txt } from '@mastra/playground-ui';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  InboxIcon,
  MoveRightIcon,
  PauseCircleIcon,
  SkipForwardIcon,
} from 'lucide-react';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';

export interface HeartbeatTriggersListProps {
  triggers: HeartbeatTrigger[];
  isLoading: boolean;
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

type StatusDisplay = {
  label: string;
  icon: React.ReactNode;
  tone: 'success' | 'info' | 'muted' | 'error';
};

function statusDisplay(outcome: ScheduleTriggerOutcome): StatusDisplay {
  switch (outcome) {
    case 'succeeded':
      return { label: 'succeeded', icon: <CheckCircle2Icon size={14} />, tone: 'success' };
    case 'delivered':
      return { label: 'delivered', icon: <MoveRightIcon size={14} />, tone: 'info' };
    case 'persisted':
      return { label: 'persisted', icon: <InboxIcon size={14} />, tone: 'info' };
    case 'discarded':
      return { label: 'discarded', icon: <CircleSlashIcon size={14} />, tone: 'muted' };
    case 'skipped':
      return { label: 'skipped', icon: <SkipForwardIcon size={14} />, tone: 'muted' };
    case 'aborted':
      return { label: 'aborted', icon: <PauseCircleIcon size={14} />, tone: 'muted' };
    case 'failed':
      return { label: 'failed', icon: <AlertTriangleIcon size={14} />, tone: 'error' };
    default:
      return { label: outcome, icon: <CheckCircle2Icon size={14} />, tone: 'success' };
  }
}

const TONE_CLASS: Record<StatusDisplay['tone'], string> = {
  success: 'text-accent1',
  info: 'text-icon3',
  muted: 'text-neutral4',
  error: 'text-accent2',
};

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
        <DataList.TopCell>Run</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Started</DataList.TopCell>
      </DataList.Top>

      {triggers.map(t => {
        const driftMs = t.actualFireAt - t.scheduledFireAt;
        const driftValue = formatDriftValue(driftMs);
        const startedTooltip = `Scheduled ${formatScheduleTimestamp(t.scheduledFireAt)} — published ${formatScheduleTimestamp(t.actualFireAt)} (drift ${driftValue})`;
        const isPublishFailure = t.outcome === 'failed';
        const display = statusDisplay(t.outcome);
        const absDrift = Math.abs(driftMs);
        const showDriftWarning = !isPublishFailure && absDrift > DRIFT_WARN_MIN_MS && absDrift <= DRIFT_WARN_MAX_MS;
        const rowKey = `${t.scheduleId}-${t.actualFireAt}-${t.runId ?? 'none'}`;

        const runIdLabel = t.runId ? (
          <span className="text-neutral3 font-mono text-ui-sm whitespace-nowrap" data-testid="heartbeat-trigger-run-id">
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
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm ${TONE_CLASS[display.tone]}`}
                        data-testid="heartbeat-trigger-outcome"
                      >
                        {display.icon}
                        {display.label}
                      </span>
                    </TooltipTrigger>
                    {t.error ? <TooltipContent>{t.error}</TooltipContent> : null}
                  </Tooltip>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap text-ui-sm ${TONE_CLASS[display.tone]}`}
                    data-testid="heartbeat-trigger-outcome"
                  >
                    {display.icon}
                    {display.label}
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

        return <DataList.RowStatic key={rowKey}>{cells}</DataList.RowStatic>;
      })}

      <DataList.NextPageLoading
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </DataList>
  );
}
