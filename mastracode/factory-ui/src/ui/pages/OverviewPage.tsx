import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Check, ChevronDown, CircleCheck, Clock3, Layers3 } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';

import { useFactoryMetrics } from '../../hooks/useFactoryMetrics';
import { useRunningSessions } from '../../hooks/useWorkItems';
import { formatDuration } from '../../lib/date';
import { morph } from '../lib/morphTransition';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { QueueHealthPanel } from '../domains/factory/components/QueueHealthPanel';
import { ShareBar } from '../domains/factory/components/ShareBar';
import { Sparkline } from '../domains/factory/components/Sparkline';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { PIPELINE_STAGES, stageLabel, stageOrder } from '../domains/factory/stages';

const DAY_MS = 86_400_000;

function shiftUtcDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

// all inside the server's 366-day aggregation cap
const RANGE_PRESETS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
];

const DEFAULT_RANGE_DAYS = 30;

const THROUGHPUT_SERIES = [{ dataKey: 'done', label: 'Completed work', color: 'var(--chart-2)' }];

const SOURCE_COLORS = ['bg-chart-soft-1', 'bg-chart-soft-2', 'bg-chart-soft-3', 'bg-chart-soft-4', 'bg-chart-soft-5'];

const SOURCE_LABELS: Record<string, string> = {
  'github:issue': 'GitHub issues',
  'github:pull-request': 'GitHub PRs',
  'linear:issue': 'Linear issues',
  manual: 'Manual',
};

const EM_DASH = '—';

/** Both section titles, so "Now" and the range picker read as the same rank. */
const SECTION_TITLE = 'text-ui-sm text-icon5 m-0 font-medium';
const BLOCK_TITLE = 'text-ui-xs text-icon3 m-0 tracking-wider uppercase';

export function OverviewPage() {
  return (
    <DocumentFactoryPageShell>{project => <OverviewContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
}

/** Split by time, not topic: the queue is live, everything under the picker is windowed. */
function OverviewContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const range = useMemo(() => ({ from: shiftUtcDay(today, -(rangeDays - 1)), to: today }), [today, rangeDays]);
  const metricsQuery = useFactoryMetrics(factoryProjectId, range);
  const agentsRunning = useRunningSessions(factoryProjectId).size;

  if (metricsQuery.isError) {
    const message = metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const metrics = metricsQuery.data;
  if (!metrics) return <OverviewLoading />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 pb-16">
      <h1 className="sr-only">Overview</h1>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>Now</h2>
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Readout
              icon={<Layers3 aria-hidden="true" />}
              label="In flight"
              value={String(metrics.wipTotal)}
              detail="Factory work past intake"
            />
            <Readout
              icon={<Bot aria-hidden="true" />}
              label="Agents running"
              value={String(agentsRunning)}
              detail="Sessions with a run in progress"
            />
          </dl>
        </div>
        <Block title="Queue health">
          <QueueHealthPanel factoryProjectId={factoryProjectId} />
        </Block>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>
            {/* the picker is the heading; heading navigation needs more than "Last 30 days" */}
            <span className="sr-only">Delivered over </span>
            <RangePicker rangeDays={rangeDays} onSelect={setRangeDays} />
          </h2>
          <Flow metrics={metrics} />
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Block title="Work intake">
            <SourceMix metrics={metrics} />
          </Block>
          <Block
            title="Agent coverage"
            note="First pass through each stage, finished by an agent rather than a person."
          >
            <AgentCoverage metrics={metrics} />
          </Block>
        </div>
      </section>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className={BLOCK_TITLE}>{title}</h3>
        {note ? (
          <Txt as="p" variant="ui-xs" className="text-icon3 m-0">
            {note}
          </Txt>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RangePicker({ rangeDays, onSelect }: { rangeDays: number; onSelect: (days: number) => void }) {
  const current = RANGE_PRESETS.find(preset => preset.days === rangeDays) ?? RANGE_PRESETS[1]!;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        type="button"
        aria-label={`Date range: ${current.label}`}
        className="text-icon5 hover:text-icon6 focus-visible:outline-accent1 -mx-1 flex cursor-pointer items-center gap-1 rounded-md px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {current.label}
        <ChevronDown className="text-icon3 size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-44">
        {RANGE_PRESETS.map(preset => (
          <DropdownMenu.Item key={preset.days} onSelect={() => onSelect(preset.days)}>
            <span className="flex-1">{preset.label}</span>
            {preset.days === current.days && <Check aria-label="Selected" />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function OverviewLoading() {
  return (
    <div
      role="status"
      aria-label="Loading factory overview"
      className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl sm:col-span-2 lg:col-span-3" />
      <Skeleton className="h-28 w-full rounded-xl sm:col-span-2" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

function Flow({ metrics }: { metrics: FactoryMetrics }) {
  const completed = metrics.throughput.reduce((sum, point) => sum + point.count, 0);

  return (
    <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <ThroughputCard metrics={metrics} completed={completed} />
      <Readout
        icon={<Clock3 aria-hidden="true" />}
        label="Median lead time"
        value={formatDuration(metrics.leadTime.medianMs)}
        detail={
          metrics.leadTime.p90Ms === null
            ? `${metrics.leadTime.samples} completed samples`
            : `p90 ${formatDuration(metrics.leadTime.p90Ms)} · ${metrics.leadTime.samples} samples`
        }
      />
    </dl>
  );
}

function ThroughputCard({ metrics, completed }: { metrics: FactoryMetrics; completed: number }) {
  const [expanded, setExpanded] = useState(false);
  const chartId = useId();
  const { daysCovered } = metrics;
  const averagePerDay = daysCovered === 0 ? 0 : completed / daysCovered;
  const perDay = `${averagePerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })} per day`;

  return (
    <div
      style={{ viewTransitionName: 'throughput-card' }}
      className={`border-border1 bg-surface3 hover:border-border2 group flex min-w-0 flex-col rounded-xl border p-4 transition-colors ${
        expanded ? 'col-span-full' : 'sm:col-span-2'
      }`}
    >
      <dt className="text-ui-xs text-icon3 flex items-center gap-1.5 tracking-wider uppercase [&>svg]:size-3.5">
        <CircleCheck aria-hidden="true" className="text-positive1" />
        Completed
      </dt>

      <dd className="m-0 mt-3 flex min-w-0 flex-col">
        <div className="relative flex items-center justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-header-xl text-icon6 font-medium tabular-nums">{completed}</span>
            <Txt as="span" variant="ui-xs" className="text-icon3">
              {perDay}
            </Txt>
          </span>

          <span className="flex shrink-0 items-center gap-3">
            {expanded ? null : (
              <Sparkline
                values={metrics.throughput.map(point => point.count)}
                color="var(--chart-2)"
                className="h-12 w-24 opacity-80 transition-opacity duration-200 group-hover:opacity-100 sm:w-44"
              />
            )}
            <ChevronDown
              aria-hidden="true"
              className={`text-icon3 size-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </span>

          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? chartId : undefined}
            aria-label={`Completed: ${completed}, ${perDay}. ${expanded ? 'Hide' : 'Show'} the daily completions chart`}
            onClick={() => morph(() => setExpanded(open => !open))}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        {expanded ? (
          <div
            id={chartId}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 mt-5 motion-safe:duration-300"
          >
            <Txt as="p" variant="ui-xs" className="text-icon3 m-0 mb-2">
              Daily completions over {daysCovered} days
            </Txt>
            <MetricsLineChart
              data={metrics.throughput.map(point => ({ time: point.date, done: point.count }))}
              series={THROUGHPUT_SERIES}
              height={260}
              xAxisInterval="preserveStartEnd"
              xAxisMinTickGap={40}
            />
          </div>
        ) : null}
      </dd>
    </div>
  );
}

function Readout({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="border-border1 bg-surface3 hover:border-border2 flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-colors">
      <dt className="text-ui-xs text-icon3 flex items-center gap-1.5 tracking-wider uppercase [&>svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="m-0 flex min-w-0 flex-col gap-0.5">
        <span className="text-header-md text-icon6 font-medium tabular-nums">{value}</span>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {detail}
        </Txt>
      </dd>
    </div>
  );
}

function AgentCoverage({ metrics }: { metrics: FactoryMetrics }) {
  // rows exist only for stages with ≥1 finished pass
  if (metrics.agentCoverage.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        No completed stage passes in this window yet.
      </Txt>
    );
  }
  const describe = (stage: string, byAgent: number, passes: number, pct: number | null, outcomes: string) =>
    pct === null
      ? `${stageLabel(stage)}: no completed passes`
      : `${stageLabel(stage)}: ${pct}% agent-run, ${byAgent} of ${passes} passes${outcomes ? ` — ${outcomes}` : ''}`;

  const rowsByStage = new Map(metrics.agentCoverage.map(row => [row.stage, row]));
  // board stages in column order, then unknown ids last — same rule as stageOrder
  const stageIds = new Set<string>(PIPELINE_STAGES);
  for (const row of metrics.agentCoverage) {
    stageIds.add(row.stage);
  }
  const stages = [...stageIds].sort((a, b) => stageOrder(a) - stageOrder(b));

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {stages.map(stage => {
        const row = rowsByStage.get(stage);
        const passes = row?.passes ?? 0;
        const byAgent = row?.byAgent ?? 0;
        const pct = passes === 0 ? null : Math.round((byAgent / passes) * 100);
        const outcomes = row && byAgent > 0 ? outcomeSummary(row.outcomes) : '';
        return (
          <li
            key={stage}
            className="group hover:bg-surface4 grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
          >
            <Txt as="span" variant="ui-sm" className="text-icon4 truncate">
              {stageLabel(stage)}
            </Txt>
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={describe(stage, byAgent, passes, pct, outcomes)}
                    className="bg-surface4 focus-visible:outline-accent1 h-2 overflow-hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {pct !== null && byAgent > 0 ? (
                      <div
                        className="bg-chart-soft-1 h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    ) : null}
                  </div>
                }
              />
              <TooltipContent>
                {pct === null ? 'No completed passes' : `${byAgent} of ${passes} passes run by an agent`}
                {outcomes ? ` · ${outcomes}` : ''}
              </TooltipContent>
            </Tooltip>
            <span className="bg-surface4 group-hover:bg-surface6 text-ui-xs text-icon4 shrink-0 rounded-full px-2 py-0.5 tabular-nums transition-colors">
              {pct === null ? EM_DASH : `${pct}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function outcomeSummary(outcomes: FactoryMetrics['agentCoverage'][number]['outcomes']): string {
  const parts: string[] = [];
  if (outcomes.done > 0) parts.push(`${outcomes.done} done`);
  if (outcomes.canceled > 0) parts.push(`${outcomes.canceled} canceled`);
  if (outcomes.reworked > 0) parts.push(`${outcomes.reworked} reworked`);
  if (outcomes.inFlight > 0) parts.push(`${outcomes.inFlight} in flight`);
  return parts.join(', ');
}

function SourceMix({ metrics }: { metrics: FactoryMetrics }) {
  const total = metrics.sourceMix.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        No items created in this window.
      </Txt>
    );
  }
  // sorted so the color ramp reads largest → smallest
  const slices = [...metrics.sourceMix]
    .sort((a, b) => b.count - a.count)
    .map((entry, index) => ({
      key: entry.source,
      label: SOURCE_LABELS[entry.source] ?? entry.source,
      value: entry.count,
      color: SOURCE_COLORS[index % SOURCE_COLORS.length]!,
    }));
  return <ShareBar slices={slices} />;
}
