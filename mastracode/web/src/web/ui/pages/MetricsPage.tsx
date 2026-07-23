import { DateRangeTimeline, getDateRangeBounds } from '@mastra/playground-ui/components/DateRangeTimeline';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { DateRangeValue } from '@mastra/playground-ui/components/DateRangeTimeline';
import {
  MetricsBarChart,
  type MetricsBarChartSeries,
} from '@mastra/playground-ui/components/MetricsBarChart';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Clock3, Layers3, Workflow } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../shared/api/config';
import { useEnsureMaterializedSandbox } from '../../../shared/hooks/useEnsureMaterializedSandbox';
import { useFactoryQuery } from '../../../shared/hooks/useFactories';
import { useFactoryMetrics } from '../../../shared/hooks/useFactoryMetrics';
import { useWorkspaceActivity } from '../../../shared/hooks/useWorkspaceActivity';
import { useWorkspacesQuery } from '../../../shared/hooks/useWorkspaces';
import { formatDuration, relativeTime } from '../../../shared/lib/date';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
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

const THROUGHPUT_COLOR = 'oklch(from var(--accent1) l calc(c * 0.72) h)';
const THROUGHPUT_LEGEND_STYLE = { backgroundColor: THROUGHPUT_COLOR };
const THROUGHPUT_SERIES: Array<MetricsBarChartSeries> = [
  { dataKey: 'done', label: 'Completed work', color: THROUGHPUT_COLOR, appearance: 'dotted' },
];
const THROUGHPUT_AXIS_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const THROUGHPUT_TOOLTIP_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatThroughputDate(value: unknown, formatter: Intl.DateTimeFormat): string {
  if (typeof value !== 'string') return String(value ?? '');

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? value : formatter.format(timestamp);
}


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
  return (
    <DocumentFactoryPageShell>{project => <MetricsContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <MetricsSection
        title="Reporting period"
        description="Drag the range or use the date controls to compare a different window."
        action={<Badge size="sm">{windowDays} days</Badge>}
      >
        <DateRangeTimeline
          key={`${bounds.min}:${bounds.max}`}
          value={range}
          min={bounds.min}
          max={bounds.max}
          onCommit={value => setRange(clampRangeSpan(value, MAX_METRICS_WINDOW_DAYS))}
        />
      </MetricsSection>

      {!metrics ? (
        <MetricsLoading />
      ) : (
        <>
          <FlowOverview metrics={metrics} agentsRunning={agentsRunning} windowDays={windowDays} />

          <QueueHealthSection factoryProjectId={factoryProjectId} />

          <div className="grid items-start gap-8 xl:grid-cols-2">
            <MetricsSection
              title="Automation coverage"
              description="Completed stage passes handled end to end by automation."
            >
              <StageAutomation metrics={metrics} />
            </MetricsSection>
            <MetricsSection title="Work intake" description="Where new work entered during this period.">
              <SourceMix metrics={metrics} />
            </MetricsSection>
          </div>

          <MetricsSection
            title="Aging work"
            description="In-flight items ordered by time spent in their current stage."
          >
            <AgingWipTable metrics={metrics} />
          </MetricsSection>
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

function MetricsLoading() {
  return (
    <div className="grid gap-5 border-t border-border1 pt-7" aria-label="Loading Factory metrics">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function FlowOverview({
  metrics,
  agentsRunning,
  windowDays,
}: {
  metrics: FactoryMetrics;
  agentsRunning: number;
  windowDays: number;
}) {
  const completed = metrics.throughput.reduce((sum, point) => sum + point.count, 0);
  const averagePerDay = completed / windowDays;
  const automatedMoves = metrics.transitions.total - metrics.transitions.human;
  const automationRate =
    metrics.transitions.total === 0 ? EM_DASH : `${Math.round((automatedMoves / metrics.transitions.total) * 100)}%`;

  return (
    <section className="flex flex-col gap-5 border-t border-border1 pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Txt as="h2" variant="ui-md" className="m-0 font-medium text-icon6">
            Delivery flow
          </Txt>
          <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
            Completed work over time, with the Factory's current operating state.
          </Txt>
        </div>
        <Badge size="sm">{windowDays}-day view</Badge>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border1 pt-4 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border1">
        <OverviewReadout
          icon={<Clock3 aria-hidden="true" />}
          label="Median cycle time"
          value={formatDuration(metrics.cycleTime.medianMs)}
          detail={
            metrics.cycleTime.p90Ms === null
              ? `${metrics.cycleTime.samples} completed samples`
              : `p90 ${formatDuration(metrics.cycleTime.p90Ms)} · ${metrics.cycleTime.samples} samples`
          }
        />
        <OverviewReadout
          icon={<Layers3 aria-hidden="true" />}
          label="In flight"
          value={String(metrics.wipTotal)}
          detail="Items in non-terminal stages"
        />
        <OverviewReadout
          icon={<Bot aria-hidden="true" />}
          label="Agents running"
          value={String(agentsRunning)}
          detail="Live across active worktrees"
        />
        <OverviewReadout
          icon={<Workflow aria-hidden="true" />}
          label="Automated moves"
          value={automationRate}
          detail={
            metrics.transitions.total === 0
              ? 'No stage moves in this window'
              : `${automatedMoves} of ${metrics.transitions.total} stage moves`
          }
        />
      </dl>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <Txt as="span" variant="ui-sm" className="text-icon3">
              Completed
            </Txt>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-header-xl font-medium tabular-nums text-icon6">{completed}</span>
              <Txt as="span" variant="ui-xs" className="text-icon3">
                {averagePerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })} per day
              </Txt>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-ui-xs text-icon3">
            <span aria-hidden="true" className="size-2 rounded-sm" style={THROUGHPUT_LEGEND_STYLE} />
            Daily completions
          </div>
        </div>
        <MetricsBarChart
          data={metrics.throughput.map(point => ({ time: point.date, done: point.count }))}
          series={THROUGHPUT_SERIES}
          description="Daily completed work for the selected reporting period."
          height={220}
          xAxisInterval="preserveStartEnd"
          xAxisMinTickGap={40}
          xAxisTickFormatter={value => formatThroughputDate(value, THROUGHPUT_AXIS_DATE_FORMATTER)}
          tooltipLabelFormatter={value => formatThroughputDate(value, THROUGHPUT_TOOLTIP_DATE_FORMATTER)}
        />
      </div>
    </section>
  );
}

function OverviewReadout({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 flex-col lg:px-4 lg:first:pl-0 lg:last:pr-0">
      <dt className="flex items-center gap-1.5 text-ui-xs text-icon3 [&>svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="m-0 mt-1 text-header-sm font-medium tabular-nums text-icon6">{value}</dd>
      <Txt as="span" variant="ui-xs" className="mt-0.5 text-icon3">
        {detail}
      </Txt>
    </div>
  );
}

function MetricsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border1 pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Txt as="h2" variant="ui-md" className="m-0 font-medium text-icon6">
            {title}
          </Txt>
          <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
            {description}
          </Txt>
        </div>
        {action}
      </div>
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
  const stageIds = new Set<string>();
  for (const stage of BOARD_STAGES) {
    if (!TERMINAL_STAGE_IDS.has(stage.id)) stageIds.add(stage.id);
  }
  for (const row of metrics.stageAutomation) {
    stageIds.add(row.stage);
  }
  const stages = [...stageIds].sort((a, b) => stageOrder(a) - stageOrder(b));

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {stages.map(stage => {
        const row = rowsByStage.get(stage);
        const exits = row?.exits ?? 0;
        const automated = row?.automated ?? 0;
        const pct = exits === 0 ? null : Math.round((automated / exits) * 100);
        return (
          <li key={stage} className="grid gap-1.5 border-b border-border1 py-3 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <Txt as="span" variant="ui-sm" className="font-medium text-icon5">
                {stageLabel(stage)}
              </Txt>
              <Txt as="span" variant="ui-xs" className="text-right tabular-nums text-icon3">
                {pct === null ? 'No completed passes' : `${pct}% automated · ${automated}/${exits}`}
              </Txt>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface4" aria-hidden="true">
              {pct !== null && automated > 0 ? (
                <div className="h-full rounded-full bg-accent1" style={{ width: `${Math.max(2, pct)}%` }} />
              ) : null}
            </div>
            {row && automated > 0 ? (
              <Txt as="span" variant="ui-xs" className="text-icon3">
                Current outcomes: {outcomeSummary(row.outcomes)}
              </Txt>
            ) : null}
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
          className="flex min-w-0 flex-col gap-2 border-b border-border1 py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-ui-sm font-medium text-icon5 no-underline hover:text-icon6 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1"
              >
                {item.title}
              </a>
            ) : (
              <span className="block truncate text-ui-sm font-medium text-icon5">{item.title}</span>
            )}
            <Txt as="span" variant="ui-xs" className="mt-0.5 block text-icon3">
              In this stage {relativeTime(item.enteredAt) || 'just now'}
            </Txt>
          </div>
          <Badge size="xs">{stageLabel(item.stage)}</Badge>
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
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {metrics.sourceMix.map(entry => {
        const percentage = Math.round((entry.count / total) * 100);
        return (
          <li key={entry.source} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Txt as="span" variant="ui-sm" className="font-medium text-icon5">
                {SOURCE_LABELS[entry.source] ?? entry.source}
              </Txt>
              <Txt as="span" variant="ui-xs" className="tabular-nums text-icon3">
                {entry.count} · {percentage}%
              </Txt>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface4" aria-hidden="true">
              <div className="h-full rounded-full bg-accent3" style={{ width: `${Math.max(2, percentage)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
