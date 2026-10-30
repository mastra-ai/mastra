import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon, CoinsIcon, HashIcon, MessagesSquareIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCardGroup } from '../MetricsCardGroup';
import { MetricsKpiCard } from '../MetricsKpiCard';
import { MetricsLineChart, MetricsLineChartLegend } from '../MetricsLineChart';
import type { MetricsLineChartSeries } from '../MetricsLineChart';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { ShareBar } from '../ShareBar';
import type { ShareBarRow } from '../ShareBar';
import { MetricsCard } from './metrics-card';
import type { MetricsCardTitleMenuProps } from './metrics-card-title-menu';
import { agentActivityByHour, count, ms, percent, traceVolume, usageBy, usd } from './metrics-story-data';

const meta: Meta = {
  title: 'Metrics/Examples/Metrics Overview',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const data = agentActivityByHour;
const score = (value: number) => value.toFixed(2);

const kpis = [
  {
    label: 'Agent runs',
    icon: <BotIcon />,
    value: '147',
    changePct: -8.1,
    detail: '9 failed',
    prev: '160',
  },
  {
    label: 'Model cost',
    icon: <CoinsIcon />,
    value: '$30.02',
    changePct: 40,
    lowerIsBetter: true,
    detail: '4 models',
    prev: '$21.44',
  },
  { label: 'Tokens', icon: <HashIcon />, value: '39.4M', changePct: -15, detail: '76% input', prev: '46.4M' },
  {
    label: 'Threads',
    icon: <MessagesSquareIcon />,
    value: '12',
    changePct: -14,
    detail: '7 active today',
    prev: '14',
  },
];

function Kpis({ isLoading }: { isLoading: boolean }) {
  return (
    <MetricsCardGroup>
      {kpis.map(kpi => (
        <MetricsKpiCard key={kpi.label}>
          <MetricsKpiCard.Label icon={kpi.icon}>{kpi.label}</MetricsKpiCard.Label>
          <MetricsKpiCard.ValueRow className="mt-1" isLoading={isLoading}>
            <MetricsKpiCard.Value>{kpi.value}</MetricsKpiCard.Value>
            <MetricsKpiCard.Change changePct={kpi.changePct} prevValue={kpi.prev} lowerIsBetter={kpi.lowerIsBetter} />
          </MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Footer detail={kpi.detail} prevValue={kpi.prev} isLoading={isLoading} />
        </MetricsKpiCard>
      ))}
    </MetricsCardGroup>
  );
}

/** A card whose content is a flex column, so `height="fill"` charts end cards in a row on one line. */
function Card({
  title,
  titleMenu,
  total,
  isLoading,
  children,
}: {
  title: string;
  /** Makes the title a dropdown of the card's views; `title` is the picked view's label. */
  titleMenu?: Omit<MetricsCardTitleMenuProps<string>, 'title' | 'className'>;
  total: string;
  isLoading: boolean;
  children: ReactNode;
}) {
  return (
    <MetricsCard className="min-h-0! min-w-0!">
      <MetricsCard.TopBar>
        {titleMenu ? (
          <MetricsCard.TitleMenu title={title} {...titleMenu} />
        ) : (
          <MetricsCard.Title>{title}</MetricsCard.Title>
        )}
        <MetricsCard.Total value={total} isLoading={isLoading} />
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex h-full flex-col gap-4 overflow-visible">{children}</MetricsCard.Content>
    </MetricsCard>
  );
}

/** The views of a card with a title menu, and the title for the picked one. */
function views<T extends string>(options: readonly { value: T; label: string }[], value: T) {
  return { options, title: options.find(o => o.value === value)?.label ?? '' };
}

type Loadable = { isLoading: boolean };

const TOKEN_VIEWS = [
  { value: 'tokens', label: 'Token usage' },
  { value: 'cost', label: 'Model cost' },
] as const;

/** Tokens and cost share one chart: the title menu swaps the series, the legend sits in the toolbar. */
function TokenUsageCard({ isLoading }: Loadable) {
  const [tab, setTab] = useState<'tokens' | 'cost'>('tokens');
  const { title, options } = views(TOKEN_VIEWS, tab);
  const series: MetricsLineChartSeries[] =
    tab === 'tokens'
      ? [
          { dataKey: 'input', label: 'Input', color: 'var(--chart-blue)' },
          { dataKey: 'cacheRead', label: 'Cache read', color: 'var(--chart-blue-deep)' },
          { dataKey: 'output', label: 'Output', color: 'var(--chart-amber)' },
        ]
      : [{ dataKey: 'cost', label: 'Cost', color: 'var(--chart-purple)' }];
  return (
    <Card
      title={title}
      titleMenu={{ value: tab, onValueChange: v => setTab(v as typeof tab), options }}
      total={tab === 'tokens' ? '39.4M' : '$30.02'}
      isLoading={isLoading}
    >
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={series} />
      </MetricsCard.Toolbar>
      <MetricsStackedBarChart
        data={data}
        series={series}
        height={240}
        showLegend={false}
        showYAxis={false}
        valueFormatter={tab === 'tokens' ? count : usd}
        isLoading={isLoading}
      />
    </Card>
  );
}

const small = { data, height: 'fill', xLabels: 'edges', showYAxis: false } as const;

function AgentRunsCard({ isLoading }: Loadable) {
  return (
    <Card title="Agent runs" total="147" isLoading={isLoading}>
      <MetricsStackedBarChart
        {...small}
        series={[
          { dataKey: 'completed', label: 'Completed', color: 'var(--chart-blue)' },
          { dataKey: 'failed', label: 'Failed', color: 'var(--chart-red)' },
        ]}
        valueFormatter={count}
        isLoading={isLoading}
      />
    </Card>
  );
}

function FailureRateCard({ isLoading }: Loadable) {
  return (
    <Card title="Failure rate" total="6.1%" isLoading={isLoading}>
      <MetricsLineChart
        {...small}
        series={[{ dataKey: 'failureRate', label: 'Failed runs', color: 'var(--chart-red)' }]}
        valueFormatter={percent}
        isLoading={isLoading}
      />
    </Card>
  );
}

const LATENCY_KEYS = {
  agents: ['p50', 'p95'],
  workflows: ['wfP50', 'wfP95'],
  tools: ['toolP50', 'toolP95'],
} as const;

const LATENCY_VIEWS = [
  { value: 'agents', label: 'Agent latency' },
  { value: 'workflows', label: 'Workflow latency' },
  { value: 'tools', label: 'Tool latency' },
] as const;

function LatencyCard({ isLoading }: Loadable) {
  const [tab, setTab] = useState<keyof typeof LATENCY_KEYS>('agents');
  const { title, options } = views(LATENCY_VIEWS, tab);
  const [p50, p95] = LATENCY_KEYS[tab];
  const series: MetricsLineChartSeries[] = [
    { dataKey: p50, label: 'P50', color: 'var(--chart-sequential-1)' },
    { dataKey: p95, label: 'P95', color: 'var(--chart-sequential-3)', emphasis: true },
  ];
  return (
    <Card
      title={title}
      titleMenu={{ value: tab, onValueChange: v => setTab(v as typeof tab), options }}
      total={ms(Math.max(...data.map(b => b[p95])))}
      isLoading={isLoading}
    >
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={series} />
      </MetricsCard.Toolbar>
      <MetricsLineChart {...small} series={series} showLegend={false} valueFormatter={ms} isLoading={isLoading} />
    </Card>
  );
}

type VolumeTab = keyof typeof traceVolume;

const VOLUME_VIEWS = [
  { value: 'agents', label: 'Agent runs' },
  { value: 'workflows', label: 'Workflow runs' },
  { value: 'tools', label: 'Tool calls' },
] as const satisfies readonly { value: VolumeTab; label: string }[];

/** Trace volume with an error-rate column, so the failing agent or tool stands out. */
function TraceVolumeCard({ isLoading }: Loadable) {
  const [tab, setTab] = useState<VolumeTab>('agents');
  const { title, options } = views(VOLUME_VIEWS, tab);
  const rate = (errors: number, runs: number) => (errors > 0 ? percent(errors / runs) : '0%');
  const rows: ShareBarRow[] = traceVolume[tab].map(r => ({
    key: r.label,
    label: r.label,
    share: r.runs,
    value: count(r.runs),
    cells: [rate(r.errors, r.runs)],
  }));
  const errorsOf = new Map(traceVolume[tab].map(r => [r.label, r.errors]));
  const total = traceVolume[tab].reduce((sum, r) => sum + r.runs, 0);
  const columns = [{ label: 'Error rate' }];
  return (
    <Card
      title={title}
      titleMenu={{ value: tab, onValueChange: v => setTab(v as VolumeTab), options }}
      total={count(total)}
      isLoading={isLoading}
    >
      <ShareBar
        key={tab}
        rows={rows}
        columns={columns}
        valueLabel="Runs"
        color="var(--chart-blue)"
        other={rest => {
          const errors = rest.reduce((sum, r) => sum + (errorsOf.get(r.key) ?? 0), 0);
          const runs = rest.reduce((sum, r) => sum + r.share, 0);
          return { value: count(runs), cells: [rate(errors, runs)] };
        }}
        isLoading={isLoading}
      />
    </Card>
  );
}

type UsageTab = keyof typeof usageBy;

const USAGE_VIEWS = [
  { value: 'agents', label: 'Usage by agent' },
  { value: 'models', label: 'Usage by model' },
  { value: 'threads', label: 'Usage by thread' },
] as const satisfies readonly { value: UsageTab; label: string }[];

/** Usage by agent, model and thread in one card: every view ranks by cost share, with tokens. */
function UsageCard({ isLoading }: Loadable) {
  const [tab, setTab] = useState<UsageTab>('agents');
  const { title, options } = views(USAGE_VIEWS, tab);
  const source = usageBy[tab];
  const tokensOf = new Map(source.map(r => [r.label, r.tokens]));
  const rows: ShareBarRow[] = source.map(r => ({
    key: r.label,
    label: r.label,
    share: r.cost,
    value: usd(r.cost),
    cells: [count(r.tokens)],
  }));
  const columns = [{ label: 'Tokens' }];
  return (
    <Card
      title={title}
      titleMenu={{ value: tab, onValueChange: v => setTab(v as UsageTab), options }}
      total={usd(source.reduce((sum, r) => sum + r.cost, 0))}
      isLoading={isLoading}
    >
      <ShareBar
        key={tab}
        rows={rows}
        columns={columns}
        valueLabel="Cost"
        color="var(--chart-purple)"
        other={rest => ({
          value: usd(rest.reduce((sum, r) => sum + r.share, 0)),
          cells: [count(rest.reduce((sum, r) => sum + (tokensOf.get(r.key) ?? 0), 0))],
        })}
        isLoading={isLoading}
      />
    </Card>
  );
}

const SCORE_SERIES: MetricsLineChartSeries[] = [
  { dataKey: 'relevancy', label: 'Answer relevancy', color: 'var(--chart-green)' },
  { dataKey: 'faithfulness', label: 'Faithfulness', color: 'var(--chart-blue)' },
  { dataKey: 'tone', label: 'Tone', color: 'var(--chart-orange)' },
];

/** Eval scores over time: the average scorer result per hour, 0 to 1. */
function ScoresCard({ isLoading }: Loadable) {
  return (
    <Card title="Scores" total="3" isLoading={isLoading}>
      <MetricsLineChart
        data={data}
        series={SCORE_SERIES}
        height={200}
        yDomain={[0, 1]}
        showYAxis={false}
        valueFormatter={score}
        isLoading={isLoading}
      />
    </Card>
  );
}

/**
 * The Metrics page: KPIs, Token usage, a row of three that wraps to two plus a full-width third
 * on medium pages (container queries, so it follows the page, not the window), the two share
 * lists side by side, then Scores.
 */
function MetricsPage({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <div className="grid content-start gap-4">
      <Kpis isLoading={isLoading} />
      <TokenUsageCard isLoading={isLoading} />
      <div className="@container">
        <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          <AgentRunsCard isLoading={isLoading} />
          <FailureRateCard isLoading={isLoading} />
          <div className="grid @2xl:col-span-2 @5xl:col-span-1">
            <LatencyCard isLoading={isLoading} />
          </div>
        </div>
      </div>
      <div className="@container">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <TraceVolumeCard isLoading={isLoading} />
          <UsageCard isLoading={isLoading} />
        </div>
      </div>
      <ScoresCard isLoading={isLoading} />
    </div>
  );
}

/** The final Metrics page composition. Narrow the canvas: the row of three wraps to 2 + 1. */
export const MetricsOverview: Story = { render: () => <MetricsPage /> };

/** The same page while every query loads. */
export const Loading: Story = { render: () => <MetricsPage isLoading /> };
