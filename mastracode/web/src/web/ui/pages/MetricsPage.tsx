import { DateRangeTimeline, getDateRangeBounds } from '@mastra/playground-ui/components/DateRangeTimeline';
import type { DateRangeValue } from '@mastra/playground-ui/components/DateRangeTimeline';
import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../shared/api/config';
import { useEnsureMaterializedSandbox } from '../../../shared/hooks/useEnsureMaterializedSandbox';
import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import { useFactoryMetrics } from '../../../shared/hooks/useFactoryMetrics';
import { useWorkspaceActivity } from '../../../shared/hooks/useWorkspaceActivity';
import { useWorkspacesQuery } from '../../../shared/hooks/useWorkspaces';
import { formatDuration, relativeTime } from '../../../shared/lib/date';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { QueueHealthSection } from '../domains/factory/components/QueueHealthSection';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { BOARD_STAGES, stageLabel, stageOrder } from '../domains/factory/stages';

const DAY_MS = 86_400_000;
const EMPTY_BOARD_LOOKBACK_DAYS = 90;
/** Mirrors the server's bounded aggregation window. */
const MAX_METRICS_WINDOW_DAYS = 366;

function shiftUtcDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

function inclusiveRangeDays(range: DateRangeValue): number {
  return Math.floor((Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / DAY_MS) + 1;
}

function clampRangeSpan(range: DateRangeValue, maximumDays: number): DateRangeValue {
  if (inclusiveRangeDays(range) <= maximumDays) return range;
  return { from: shiftUtcDay(range.to, -(maximumDays - 1)), to: range.to };
}

function defaultRange(today: string): DateRangeValue {
  return { from: shiftUtcDay(today, -29), to: today };
}

const THROUGHPUT_SERIES = [{ dataKey: 'done', label: 'Done per day', color: '#34d399' }];

const SOURCE_LABELS: Record<string, string> = {
  'github:issue': 'GitHub issues',
  'github:pull-request': 'GitHub PRs',
  'linear:issue': 'Linear issues',
  manual: 'Manual',
};

/** Terminal stages have no "pass through", so they never get automation rows. */
const TERMINAL_STAGE_IDS = new Set(['done', 'canceled']);

const EM_DASH = '—';

/**
 * Factory flow metrics: throughput, cycle time, live queue health, aging WIP,
 * and demand mix — aggregated server-side from the board's stage history
 * (queue health aggregates client-side in `QueueHealthSection`). "Agents
 * running" is live, from the same thread-state source as the sidebar
 * activity dots.
 */
export function MetricsPage() {
  return <FactoryPageShell>{project => <MetricsContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function MetricsContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState<DateRangeValue>(() => defaultRange(today));
  const metricsQuery = useFactoryMetrics(factoryProjectId, range);
  const agentsRunning = useAgentsRunningCount();

  if (metricsQuery.isError) {
    const message = metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const metrics = metricsQuery.data;
  // Prefer the server's count so the label stays paired with the rendered data
  // (placeholderData keeps the old range's metrics during a refetch).
  const windowDays = metrics?.windowDays ?? inclusiveRangeDays(range);

  // Keep the selected range inside the domain until the board's earliest item is known.
  const earliestDay = metrics?.earliestItemAt
    ? metrics.earliestItemAt.slice(0, 10)
    : shiftUtcDay(today, -(EMPTY_BOARD_LOOKBACK_DAYS - 1));
  const bounds = getDateRangeBounds(earliestDay < range.from ? earliestDay : range.from, today);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <DateRangeTimeline
        key={`${bounds.min}:${bounds.max}`}
        value={range}
        min={bounds.min}
        max={bounds.max}
        onCommit={value => setRange(clampRangeSpan(value, MAX_METRICS_WINDOW_DAYS))}
      />

      {!metrics ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Completed"
              value={String(metrics.throughput.reduce((sum, point) => sum + point.count, 0))}
            />
            <StatCard
              label="Median cycle time"
              value={formatDuration(metrics.cycleTime.medianMs)}
              hint={metrics.cycleTime.p90Ms !== null ? `p90 ${formatDuration(metrics.cycleTime.p90Ms)}` : undefined}
            />
            <StatCard label="In flight" value={String(metrics.wipTotal)} />
            <StatCard label="Agents running" value={String(agentsRunning)} />
            <StatCard
              label={`Automated moves (${windowDays}d)`}
              value={
                metrics.transitions.total === 0
                  ? EM_DASH
                  : String(metrics.transitions.total - metrics.transitions.human)
              }
              hint={metrics.transitions.total === 0 ? undefined : `of ${metrics.transitions.total} stage moves`}
            />
          </div>

          <Section title="Throughput">
            <MetricsLineChart
              data={metrics.throughput.map(point => ({ time: point.date, done: point.count }))}
              series={THROUGHPUT_SERIES}
              height={180}
              xAxisInterval="preserveStartEnd"
              xAxisMinTickGap={40}
            />
          </Section>

          <QueueHealthSection factoryProjectId={factoryProjectId} />

          <Section title="Automation by stage">
            <StageAutomation metrics={metrics} />
          </Section>

          <Section title="Oldest in-flight items">
            <AgingWipTable metrics={metrics} />
          </Section>

          <Section title="Source mix">
            <SourceMix metrics={metrics} />
          </Section>
        </>
      )}
    </div>
  );
}

/** Live count of worktrees with an agent run in flight (sidebar dot source). */
function useAgentsRunningCount(): number {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories[0];
  const materializeQuery = useEnsureMaterializedSandbox(repository?.projectRepositoryId);
  const workspaces = useWorkspacesQuery(repository?.projectRepositoryId);
  const workspaceSessions = workspaces.data?.workspaces ?? [];
  const resourceId = materializeQuery.data?.resourceId;
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    scope: repository?.projectRepositoryId,
    worktreePaths: workspaceSessions.map(workspace => workspace.sessionId),
    baseUrl,
    enabled: materializeQuery.isSuccess && Boolean(resourceId && repository?.projectRepositoryId),
  });
  return Object.values(runningByPath).filter(Boolean).length;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border1 bg-surface2 p-3">
      <Txt as="span" variant="ui-sm" className="text-icon3">
        {label}
      </Txt>
      <span className="text-xl text-icon6">{value}</span>
      {hint ? (
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {hint}
        </Txt>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border1 bg-surface2 p-3">
      <h2 className="m-0 text-ui-md font-medium text-icon5">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Per-stage automation: what share of completed passes through each stage was
 * fully automated (entered and exited by automation, first visit), and how
 * the automated passes' items ended up.
 */
function StageAutomation({ metrics }: { metrics: FactoryMetrics }) {
  // Rows only exist for stages with ≥1 exit, so an empty list means no stage
  // had a completed pass in the window.
  if (metrics.stageAutomation.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No completed stage passes in this window yet.
      </Txt>
    );
  }

  const rowsByStage = new Map(metrics.stageAutomation.map(row => [row.stage, row]));
  // Non-terminal board stages in column order, plus any stages present in the
  // data but unknown to the board (raw id, sorted last — same rule as
  // stageLabel/stageOrder).
  const stages = [
    ...new Set([
      ...BOARD_STAGES.map(stage => stage.id as string).filter(id => !TERMINAL_STAGE_IDS.has(id)),
      ...metrics.stageAutomation.map(row => row.stage),
    ]),
  ].sort((a, b) => stageOrder(a) - stageOrder(b));

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {stages.map(stage => {
        const row = rowsByStage.get(stage);
        const exits = row?.exits ?? 0;
        const automated = row?.automated ?? 0;
        const pct = exits === 0 ? null : Math.round((automated / exits) * 100);
        return (
          <li key={stage} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
            <Txt as="span" variant="ui-sm" className="text-icon4">
              {stageLabel(stage)}
            </Txt>
            <div className="h-2 overflow-hidden rounded-full bg-surface4">
              {pct !== null && automated > 0 ? (
                <div className="h-full rounded-full bg-accent1" style={{ width: `${Math.max(2, pct)}%` }} />
              ) : null}
            </div>
            <Txt as="span" variant="ui-xs" className="text-right text-icon3">
              {pct === null
                ? EM_DASH
                : `${pct}% automated (${automated}/${exits})${row && automated > 0 ? ` · ${outcomeSummary(row.outcomes)}` : ''}`}
            </Txt>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact split of automated-pass outcomes, omitting zero buckets. */
function outcomeSummary(outcomes: FactoryMetrics['stageAutomation'][number]['outcomes']): string {
  const parts: string[] = [];
  if (outcomes.done > 0) parts.push(`${outcomes.done} done`);
  if (outcomes.canceled > 0) parts.push(`${outcomes.canceled} canceled`);
  if (outcomes.reworked > 0) parts.push(`${outcomes.reworked} reworked`);
  if (outcomes.inFlight > 0) parts.push(`${outcomes.inFlight} in flight`);
  return parts.join(', ');
}

function AgingWipTable({ metrics }: { metrics: FactoryMetrics }) {
  if (metrics.agingWip.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        Nothing in flight — the board is clear.
      </Txt>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {metrics.agingWip.map(item => (
        <li
          key={`${item.id}:${item.stage}`}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border1 py-1.5 last:border-b-0"
        >
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-ui-sm text-icon5 no-underline hover:text-icon6 hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <span className="truncate text-ui-sm text-icon5">{item.title}</span>
          )}
          <span className="rounded-full bg-surface5 px-1.5 py-0.5 text-ui-xs text-icon4">{stageLabel(item.stage)}</span>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            in stage {relativeTime(item.enteredAt) || 'just now'}
          </Txt>
        </li>
      ))}
    </ul>
  );
}

function SourceMix({ metrics }: { metrics: FactoryMetrics }) {
  const total = metrics.sourceMix.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No items created in this window.
      </Txt>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {metrics.sourceMix.map(entry => (
        <li key={entry.source} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
          <Txt as="span" variant="ui-sm" className="text-icon4">
            {SOURCE_LABELS[entry.source] ?? entry.source}
          </Txt>
          <div className="h-2 overflow-hidden rounded-full bg-surface4">
            <div
              className="h-full rounded-full bg-accent1"
              style={{ width: `${Math.max(2, Math.round((entry.count / total) * 100))}%` }}
            />
          </div>
          <Txt as="span" variant="ui-xs" className="text-right text-icon3">
            {entry.count}
          </Txt>
        </li>
      ))}
    </ul>
  );
}
