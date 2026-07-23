import { DateRangeTimeline, getDateRangeBounds } from '@mastra/playground-ui/components/DateRangeTimeline';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { DateRangeValue } from '@mastra/playground-ui/components/DateRangeTimeline';
import { MetricsBarChart, type MetricsBarChartSeries } from '@mastra/playground-ui/components/MetricsBarChart';
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
import { StageAutomation } from '../domains/factory/components/StageAutomation';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { stageLabel } from '../domains/factory/stages';

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
const METRICS_PALETTE = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-2)'] as const;
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 pb-8">
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
              description="Completed stage passes handled end to end by automation. Select a stage bar to inspect its automated items."
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
    <div className="grid gap-5" aria-label="Loading Factory metrics">
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
    <section className="flex flex-col gap-5">
      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border1">
        <OverviewReadout
          icon={<Clock3 aria-hidden="true" />}
          label="Median cycle time"
          tone={METRICS_PALETTE[0]}
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
          tone={METRICS_PALETTE[1]}
          value={String(metrics.wipTotal)}
          detail="Items in non-terminal stages"
        />
        <OverviewReadout
          icon={<Bot aria-hidden="true" />}
          label="Agents running"
          tone={METRICS_PALETTE[2]}
          value={String(agentsRunning)}
          detail="Live across active worktrees"
        />
        <OverviewReadout
          icon={<Workflow aria-hidden="true" />}
          label="Automated moves"
          tone={METRICS_PALETTE[3]}
          value={automationRate}
          detail={
            metrics.transitions.total === 0 ? (
              'No stage moves in this window'
            ) : (
              <OverviewProgressBadge
                count={automatedMoves}
                total={metrics.transitions.total}
                label="stage moves automated"
              />
            )
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
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-col lg:px-4 lg:first:pl-0 lg:last:pr-0">
      <dt className="flex items-center gap-1.5 text-ui-xs text-icon3">
        <span
          className="grid size-5 shrink-0 place-items-center rounded-md bg-surface3 [&>svg]:size-3.5"
          style={{ color: tone }}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="m-0 mt-1 text-header-sm font-medium tabular-nums text-icon6">{value}</dd>
      <div className="mt-1 flex min-h-6 items-center">
        {typeof detail === 'string' ? (
          <Txt as="span" variant="ui-xs" className="text-icon3">
            {detail}
          </Txt>
        ) : (
          detail
        )}
      </div>
    </div>
  );
}

function OverviewProgressBadge({ count, total, label }: { count: number; total: number; label: string }) {
  const circumference = 2 * Math.PI * 5;
  const ratio = total === 0 ? 0 : Math.min(count / total, 1);
  const dashOffset = circumference * (1 - ratio);

  return (
    <span
      aria-label={`${count} of ${total} ${label}`}
      title={`${count} of ${total} ${label}`}
      className="flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-border1 bg-surface2 px-2 text-ui-xs font-medium tabular-nums text-icon4"
    >
      <svg viewBox="0 0 14 14" className="size-3.5 -rotate-90" aria-hidden="true">
        <circle cx="7" cy="7" r="5" fill="none" strokeWidth="2" className="stroke-border1" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-icon5 transition-[stroke-dashoffset] motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden="true">
        {count}/{total}
      </span>
    </span>
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
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <Txt as="h2" variant="ui-md" className="m-0 font-medium text-icon6">
            {title}
          </Txt>
          <Txt as="p" variant="ui-sm" className="m-0 text-pretty text-icon3">
            {description}
          </Txt>
        </div>
        {action}
      </div>
      {children}
    </section>
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

  const sources = metrics.sourceMix.map((entry, index) => ({
    ...entry,
    percentage: Math.round((entry.count / total) * 100),
    color: METRICS_PALETTE[index % METRICS_PALETTE.length] ?? METRICS_PALETTE[0],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-2.5 w-full gap-1" aria-hidden="true">
        {sources.map(source => (
          <span
            key={source.source}
            className="h-full min-w-1 basis-0 rounded-full"
            style={{ flexGrow: source.count, backgroundColor: source.color }}
          />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {sources.map(source => (
          <li key={source.source} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: source.color }}
                aria-hidden="true"
              />
              <Txt as="span" variant="ui-sm" className="truncate font-medium text-icon5">
                {SOURCE_LABELS[source.source] ?? source.source}
              </Txt>
            </span>
            <Txt as="span" variant="ui-xs" className="shrink-0 tabular-nums text-icon3">
              {source.count} · {source.percentage}%
            </Txt>
          </li>
        ))}
      </ul>
    </div>
  );
}
