import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Check, ChevronDown, CircleCheck, Clock3, Gauge, Inbox, Layers3, Workflow } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'react-router';

import { useApiConfig } from '../../api/config';
import { useFactoryQuery } from '../../hooks/useFactories';
import { useFactoryMetrics } from '../../hooks/useFactoryMetrics';
import { useWorkspaceActivity } from '../../hooks/useWorkspaceActivity';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import { formatDuration } from '../../lib/date';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { QueueHealthPanel } from '../domains/factory/components/QueueHealthPanel';
import { ShareBar } from '../domains/factory/components/ShareBar';
import { Sparkline } from '../domains/factory/components/Sparkline';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { BOARD_STAGES, stageLabel, stageOrder } from '../domains/factory/stages';

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

/** Terminal stages have no "pass through", so they never get automation rows. */
const TERMINAL_STAGE_IDS = new Set(['done', 'canceled']);

const EM_DASH = '—';

export function MetricsPage() {
  return (
    <DocumentFactoryPageShell>{project => <MetricsContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
}

function MetricsContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const range = useMemo(() => ({ from: shiftUtcDay(today, -(rangeDays - 1)), to: today }), [today, rangeDays]);
  const metricsQuery = useFactoryMetrics(factoryProjectId, range);
  const agentsRunning = useAgentsRunningCount();

  if (metricsQuery.isError) {
    const message = metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const metrics = metricsQuery.data;
  // server count, not the picker — placeholderData keeps the old range during a refetch
  const windowDays = metrics?.windowDays ?? rangeDays;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 pb-16">
      <h1 className="sr-only">Metrics</h1>

      <section className="flex flex-col gap-3">
        <div className="flex justify-end">
          <RangePicker rangeDays={rangeDays} onSelect={setRangeDays} />
        </div>
        {metrics ? (
          <FlowOverview metrics={metrics} agentsRunning={agentsRunning} windowDays={windowDays} />
        ) : (
          <MetricsLoading />
        )}
      </section>

      {metrics ? <BreakdownSection factoryProjectId={factoryProjectId} metrics={metrics} /> : null}
    </div>
  );
}

const BREAKDOWN_VIEWS = {
  queue: {
    label: 'Queue health',
    shortLabel: 'Queue',
    icon: Gauge,
    description: 'Live snapshot of in-flight work by time in its current stage — not scoped to the date range.',
  },
  intake: {
    label: 'Work intake',
    shortLabel: 'Intake',
    icon: Inbox,
    description: 'Where new work entered during this period.',
  },
  coverage: {
    label: 'Automation coverage',
    shortLabel: 'Automation',
    icon: Workflow,
    description: 'Completed stage passes handled end to end by automation.',
  },
} as const;

type BreakdownView = keyof typeof BREAKDOWN_VIEWS;

const PANEL_MOTION = [
  // grid panel — without minmax(0,…) its auto minimum is the longest untruncated title
  'grid-cols-[minmax(0,1fr)]',
  'overflow-visible transition-[opacity,transform] duration-300 ease-out',
  'data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0',
  'data-[ending-style]:-translate-y-1 data-[ending-style]:opacity-0 data-[ending-style]:duration-150',
  // outgoing panel out of flow — in flow both panels stack and the section balloons
  'data-[ending-style]:pointer-events-none data-[ending-style]:absolute data-[ending-style]:inset-x-0 data-[ending-style]:top-0',
  'motion-reduce:transition-none',
].join(' ');

function BreakdownSection({
  factoryProjectId,
  metrics,
}: {
  factoryProjectId: string | undefined;
  metrics: FactoryMetrics;
}) {
  const [view, setView] = useState<BreakdownView>('queue');
  return (
    <Tabs defaultTab="queue" value={view} onValueChange={setView} className="flex flex-col gap-4 overflow-visible">
      <h2 className="sr-only">Board breakdowns</h2>
      <div className="flex flex-col gap-2">
        {/* list + tab padding pulled into the gutter so labels sit on the text column */}
        <div className="-ml-4">
          <TabList variant="pill-ghost" className="text-ui-sm w-fit">
            {Object.entries(BREAKDOWN_VIEWS).map(([value, { label, shortLabel, icon: Icon }]) => (
              <Tab key={value} value={value}>
                <Icon aria-hidden="true" className="size-3.5" />
                {/* full labels overflow the strip below ~490px — the description carries the rest */}
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </Tab>
            ))}
          </TabList>
        </div>
        <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
          {BREAKDOWN_VIEWS[view].description}
        </Txt>
      </div>

      <div className="relative">
        <TabContent value="queue" className={PANEL_MOTION}>
          <QueueHealthPanel factoryProjectId={factoryProjectId} />
        </TabContent>
        <TabContent value="intake" className={PANEL_MOTION}>
          <SourceMix metrics={metrics} />
        </TabContent>
        <TabContent value="coverage" className={PANEL_MOTION}>
          <StageAutomation metrics={metrics} />
        </TabContent>
      </div>
    </Tabs>
  );
}

function RangePicker({ rangeDays, onSelect }: { rangeDays: number; onSelect: (days: number) => void }) {
  const current = RANGE_PRESETS.find(preset => preset.days === rangeDays) ?? RANGE_PRESETS[1]!;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        type="button"
        aria-label={`Date range: ${current.label}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        {current.label}
        <ChevronDown className="text-icon3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-44">
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

function useAgentsRunningCount(): number {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories[0];
  const workspaces = useWorkspacesQuery(repository?.projectRepositoryId);
  const workspaceSessions = workspaces.data?.workspaces ?? [];
  // The factory-level session address is the factory project id, so read
  // activity without materializing a sandbox for a page that only renders counts.
  const resourceId = factoryQuery.data?.id;
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    scope: repository?.projectRepositoryId,
    worktreePaths: workspaceSessions.map(workspace => workspace.sessionId),
    baseUrl,
    enabled: Boolean(resourceId && repository?.projectRepositoryId),
  });
  return Object.values(runningByPath).filter(Boolean).length;
}

function MetricsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading Factory metrics"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Skeleton className="h-28 w-full rounded-xl sm:col-span-2" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
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
    <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <ThroughputCard metrics={metrics} completed={completed} averagePerDay={averagePerDay} windowDays={windowDays} />
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
  );
}

// flushSync required — the transition captures the DOM synchronously after the callback
function morph(update: () => void) {
  const view = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void> };
  };
  if (typeof view.startViewTransition !== 'function') {
    update();
    return;
  }
  // hidden tab or overlapping transition rejects `ready` — DOM update still lands
  view.startViewTransition(() => flushSync(update)).ready.catch(() => {});
}

function ThroughputCard({
  metrics,
  completed,
  averagePerDay,
  windowDays,
}: {
  metrics: FactoryMetrics;
  completed: number;
  averagePerDay: number;
  windowDays: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const chartId = useId();
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
              Daily completions over {windowDays} days
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

function StageAutomation({ metrics }: { metrics: FactoryMetrics }) {
  // rows exist only for stages with ≥1 exit
  if (metrics.stageAutomation.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        No completed stage passes in this window yet.
      </Txt>
    );
  }
  const describe = (stage: string, automated: number, exits: number, pct: number | null, outcomes: string) =>
    pct === null
      ? `${stageLabel(stage)}: no completed passes`
      : `${stageLabel(stage)}: ${pct}% automated, ${automated} of ${exits} passes${outcomes ? ` — ${outcomes}` : ''}`;

  const rowsByStage = new Map(metrics.stageAutomation.map(row => [row.stage, row]));
  // board stages in column order, then unknown ids last — same rule as stageOrder
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
        const outcomes = row && automated > 0 ? outcomeSummary(row.outcomes) : '';
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
                    aria-label={describe(stage, automated, exits, pct, outcomes)}
                    className="bg-surface4 focus-visible:outline-accent1 h-2 overflow-hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {pct !== null && automated > 0 ? (
                      <div
                        className="bg-chart-soft-1 h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    ) : null}
                  </div>
                }
              />
              <TooltipContent>
                {pct === null ? 'No completed passes' : `${automated} of ${exits} passes automated`}
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

function outcomeSummary(outcomes: FactoryMetrics['stageAutomation'][number]['outcomes']): string {
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
