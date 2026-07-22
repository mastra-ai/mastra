import {
  DateRangeTimeline,
  clampDateRangeToBounds,
  getDateRangeBounds,
} from '@mastra/playground-ui/components/DateRangeTimeline';
import type { DateRangeValue } from '@mastra/playground-ui/components/DateRangeTimeline';
import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../../../shared/api/config';
import { useFactoryMetrics } from '../../../shared/hooks/useFactoryMetrics';
import { useWorkspaceActivity } from '../../../shared/hooks/useWorkspaceActivity';
import { deriveProjectPath, useWorkspacesQuery } from '../../../shared/hooks/useWorkspaces';
import { formatDuration, relativeTime } from '../../../shared/lib/date';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
import { isServerFactory, useActiveFactoryContext } from '../domains/workspaces';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import type { FactoryMetrics, FactoryMetricsRange } from '../domains/factory/services/metrics';
import { BOARD_STAGES, stageLabel, stageOrder } from '../domains/factory/stages';

const API_DATE_FORMAT = 'yyyy-MM-dd';
/** Domain lower bound when the board has no items yet — there's no real
 * creation date to anchor to, so offer a modest explorable window. */
const EMPTY_BOARD_LOOKBACK_DAYS = 90;

/** Default window: the last 30 days, as `yyyy-MM-dd` bounds. */
function defaultRange(): DateRangeValue {
  const today = new Date();
  return { from: format(subDays(today, 30), API_DATE_FORMAT), to: format(today, API_DATE_FORMAT) };
}

const THROUGHPUT_SERIES = [{ dataKey: 'done', label: 'Done per day', color: '#34d399' }];

const SOURCE_LABELS: Record<string, string> = {
  'github-issue': 'GitHub issues',
  'github-pr': 'GitHub PRs',
  'linear-issue': 'Linear issues',
  manual: 'Manual',
};

/**
 * Factory flow metrics: throughput, cycle time, stage breakdown, aging WIP,
 * and demand mix — aggregated server-side from the board's stage history.
 * "Agents running" is live, from the same thread-state source as the sidebar
 * activity dots.
 */
export function MetricsPage() {
  return (
    <FactoryPageShell
      title="Metrics"
      description="Flow health for this project's factory: throughput, where work stalls, and what's aging."
    >
      {project => <MetricsContent factoryProjectId={project.binding.factoryProjectId} />}
    </FactoryPageShell>
  );
}

function MetricsContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [today] = useState(() => format(new Date(), API_DATE_FORMAT));
  const [range, setRange] = useState<DateRangeValue>(defaultRange);

  // Expand the day-granular range to a precise instant window: full first day
  // through end of the last day (the server clamps the end to `now`). Keyed on
  // the day strings so the query key stays stable across renders.
  const fetchRange = useMemo<FactoryMetricsRange>(
    () => ({
      from: new Date(`${range.from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${range.to}T23:59:59.999Z`).toISOString(),
    }),
    [range.from, range.to],
  );
  const metricsQuery = useFactoryMetrics(factoryProjectId, fetchRange);
  const agentsRunning = useAgentsRunningCount();

  if (metricsQuery.isError) {
    return <Notice variant="destructive">{(metricsQuery.error as Error).message}</Notice>;
  }
  const metrics = metricsQuery.data;

  // Bounds: project's first work item (once metrics load) → today. Fall back to
  // the max lookback until the earliest date is known.
  const earliestDay = metrics?.earliestItemAt
    ? metrics.earliestItemAt.slice(0, 10)
    : format(subDays(new Date(`${today}T00:00:00.000Z`), EMPTY_BOARD_LOOKBACK_DAYS), API_DATE_FORMAT);
  const bounds = getDateRangeBounds(earliestDay, today);
  const selectedRange = clampDateRangeToBounds(range, bounds);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <DateRangeTimeline
        key={`${bounds.min}:${bounds.max}`}
        value={selectedRange}
        min={bounds.min}
        max={bounds.max}
        onCommit={setRange}
      />

      {!metrics ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

          <Section title="Stages">
            <StageBreakdown metrics={metrics} />
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
  const { activeFactory, resourceId, sessionEnabled } = useActiveFactoryContext();
  const workspaces = useWorkspacesQuery(activeFactory);
  const worktrees = workspaces.data?.worktrees ?? [];
  const projectPath = deriveProjectPath(activeFactory) || undefined;
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    worktreePaths: worktrees.map(worktree => worktree.worktreePath),
    baseUrl,
    enabled: sessionEnabled && Boolean(activeFactory && isServerFactory(activeFactory) && projectPath),
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

/** Median time-in-stage bars plus each column's current card count. */
function StageBreakdown({ metrics }: { metrics: FactoryMetrics }) {
  const wipByStage = new Map(metrics.wip.map(entry => [entry.stage, entry.count]));
  const durationByStage = new Map(metrics.stageDurations.map(entry => [entry.stage, entry]));
  const stages = [
    ...new Set([
      ...BOARD_STAGES.map(stage => stage.id as string),
      ...metrics.wip.map(entry => entry.stage),
      ...metrics.stageDurations.map(entry => entry.stage),
    ]),
  ].sort((a, b) => stageOrder(a) - stageOrder(b));
  const maxMedian = Math.max(1, ...metrics.stageDurations.map(entry => entry.medianMs));

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {stages.map(stage => {
        const duration = durationByStage.get(stage);
        const wip = wipByStage.get(stage) ?? 0;
        return (
          <li key={stage} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
            <Txt as="span" variant="ui-sm" className="text-icon4">
              {stageLabel(stage)}
            </Txt>
            <div className="h-2 overflow-hidden rounded-full bg-surface4">
              {duration ? (
                <div
                  className="h-full rounded-full bg-accent1"
                  style={{ width: `${Math.max(2, Math.round((duration.medianMs / maxMedian) * 100))}%` }}
                />
              ) : null}
            </div>
            <Txt as="span" variant="ui-xs" className="text-right text-icon3">
              {duration ? `median ${formatDuration(duration.medianMs)} · ` : ''}
              {wip} in column
            </Txt>
          </li>
        );
      })}
    </ul>
  );
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
