import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityIcon, CircleAlertIcon, SnowflakeIcon, TimerIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCardGroup } from '../MetricsCardGroup';
import { MetricsKpiCard } from '../MetricsKpiCard';
import { MetricsLineChart } from '../MetricsLineChart';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { MetricsTable } from '../MetricsTable';
import type { MetricsTableColumn } from '../MetricsTable';
import { Txt } from '../Txt';
import { MetricsCard } from './metrics-card';
import {
  coldStartSeries,
  count,
  errorRateSeries,
  ms,
  percent,
  percentileSeries,
  requestsByHour,
  requestsVsPreviousSeries,
  routeStats,
} from './metrics-story-data';
import type { RouteStat } from './metrics-story-data';

const meta: Meta = {
  title: 'Metrics/Examples/Requests Overview',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

type NumericKey = 'total' | 'prevTotal' | '5xx' | 'coldStarts' | 'p50' | 'p95' | 'wakeMs';
const sum = (key: NumericKey) => requestsByHour.reduce((total, bucket) => total + bucket[key], 0);
const mean = (key: NumericKey) => sum(key) / requestsByHour.length;
const change = (now: number, prev: number) => +(((now - prev) / prev) * 100).toFixed(1);

const totals = {
  requests: sum('total'),
  prevRequests: sum('prevTotal'),
  errors5xx: sum('5xx'),
  errorRate: sum('5xx') / sum('total'),
  coldStarts: sum('coldStarts'),
};

const kpis = [
  {
    label: 'Requests',
    icon: <ActivityIcon />,
    value: count(totals.requests),
    changePct: change(totals.requests, totals.prevRequests),
    detail: `${(totals.requests / (24 * 60)).toFixed(1)} per minute`,
    prev: count(totals.prevRequests),
  },
  {
    label: 'Error rate',
    icon: <CircleAlertIcon />,
    value: percent(totals.errorRate),
    changePct: 364,
    lowerIsBetter: true,
    detail: `${count(totals.errors5xx)} server errors`,
    prev: '0.44%',
  },
  {
    label: 'P95 latency',
    icon: <TimerIcon />,
    value: ms(mean('p95')),
    changePct: 8.1,
    lowerIsBetter: true,
    detail: `P50 ${ms(mean('p50'))}`,
    prev: '2.4s',
  },
  {
    label: 'Cold starts',
    icon: <SnowflakeIcon />,
    value: String(totals.coldStarts),
    changePct: -13,
    lowerIsBetter: true,
    detail: `Avg wake ${ms(mean('wakeMs'))}`,
    prev: '199',
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

/**
 * A card whose content is a flex column, so a `height="fill"` chart takes the free height and
 * cards in a row end on one line. Content doesn't clip, so row hovers and tooltips can reach
 * past its edge.
 */
function Card({
  title,
  description,
  summary,
  isLoading,
  children,
}: {
  title: string;
  description: string;
  summary: { value: string; label: string };
  isLoading: boolean;
  children: ReactNode;
}) {
  return (
    <MetricsCard className="min-h-0! min-w-0!">
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title={title} description={description} />
        <MetricsCard.Summary value={summary.value} label={summary.label} isLoading={isLoading} />
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex h-full flex-col gap-4 overflow-visible">{children}</MetricsCard.Content>
    </MetricsCard>
  );
}

/* Routes: one question per tab, a share strip over the ranked routes. */

type Lens = 'busiest' | 'slowest' | 'failing';

const duration = (value: number) => {
  const hours = value / 3_600_000;
  return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(value / 60_000)}m`;
};

type Column = { id: string; header: string; cell: (r: RouteStat) => string; sort: (r: RouteStat) => number };

const COLUMNS = {
  requests: { id: 'requests', header: 'Requests', cell: r => count(r.requests), sort: r => r.requests },
  rate: { id: 'rate', header: '5xx rate', cell: r => percent(r.e5xx / r.requests), sort: r => r.e5xx / r.requests },
  c4xx: { id: 'c4xx', header: '4xx', cell: r => count(r.e4xx), sort: r => r.e4xx },
  p50: { id: 'p50', header: 'P50', cell: r => ms(r.p50), sort: r => r.p50 },
  p95: { id: 'p95', header: 'P95', cell: r => ms(r.p95), sort: r => r.p95 },
} satisfies Record<string, Column>;

/**
 * Per lens: the measure the table ranks by and its column, and the supporting columns. "Time
 * spent" ranks by requests x latency, so the share column still adds up to a total.
 */
const LENSES: Record<Lens, { value: Column; columns: Column[]; empty: string }> = {
  busiest: {
    value: COLUMNS.requests,
    columns: [COLUMNS.rate, COLUMNS.p50, COLUMNS.p95],
    empty: 'No requests in this range.',
  },
  slowest: {
    value: { id: 'time', header: 'Time spent', cell: r => duration(r.timeSpentMs), sort: r => r.timeSpentMs },
    columns: [COLUMNS.requests, COLUMNS.p50, COLUMNS.p95],
    empty: 'No requests in this range.',
  },
  failing: {
    value: { id: 'e5xx', header: '5xx', cell: r => count(r.e5xx), sort: r => r.e5xx },
    columns: [COLUMNS.requests, COLUMNS.c4xx, COLUMNS.rate],
    empty: 'No 5xx responses in this range.',
  },
};

const routeKey = (r: RouteStat) => `${r.method} ${r.path}`;

function RouteName({ route }: { route: RouteStat }) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <Txt as="span" variant="body-sm" font="mono" tone="faint" className="w-14 shrink-0">
        {route.method}
      </Txt>
      <Txt as="span" variant="body-sm" font="mono" tone="ink" className="truncate">
        {route.path}
      </Txt>
    </span>
  );
}

function RoutesCard({ isLoading }: { isLoading: boolean }) {
  const [lens, setLens] = useState<Lens>('busiest');
  const [active, setActive] = useState<string>();
  const spec = LENSES[lens];
  const rows = routeStats.filter(r => spec.value.sort(r) > 0);
  const total = rows.reduce((sum, r) => sum + spec.value.sort(r), 0);
  const figure = (c: Column, muted: boolean): MetricsTableColumn<RouteStat> => ({
    id: c.id,
    header: c.header,
    align: 'end',
    sortValue: c.sort,
    cell: r => <span className={muted ? 'text-muted-foreground tabular-nums' : 'tabular-nums'}>{c.cell(r)}</span>,
  });
  const columns: MetricsTableColumn<RouteStat>[] = [
    { id: 'route', header: 'Route', width: 'minmax(16rem,3fr)', cell: r => <RouteName route={r} /> },
    ...spec.columns.map(c => figure(c, true)),
    {
      id: 'share',
      header: 'Share',
      align: 'end',
      cell: r => <span className="text-muted-foreground tabular-nums">{percent(spec.value.sort(r) / total)}</span>,
    },
    figure(spec.value, false),
  ];
  return (
    <Card
      title="Routes"
      description="Grouped by method and route. Click a row to filter the page."
      summary={{ value: String(routeStats.length), label: 'routes' }}
      isLoading={isLoading}
    >
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<Lens> value={lens} onValueChange={setLens}>
          <MetricsCard.Tab value="busiest">Busiest</MetricsCard.Tab>
          <MetricsCard.Tab value="slowest">Time spent</MetricsCard.Tab>
          <MetricsCard.Tab value="failing">Failing</MetricsCard.Tab>
        </MetricsCard.Tabs>
      </MetricsCard.Toolbar>
      {/* Remount per lens, so sort and page reset with the question. */}
      <MetricsTable
        key={lens}
        aria-label="Routes"
        columns={columns}
        rows={rows}
        getRowKey={routeKey}
        defaultSort={{ column: spec.value.id, direction: 'desc' }}
        onRowClick={r => setActive(current => (current === routeKey(r) ? undefined : routeKey(r)))}
        isRowActive={r => routeKey(r) === active}
        rowTitle={routeKey}
        pageSize={15}
        empty={spec.empty}
        isLoading={isLoading}
      />
    </Card>
  );
}

/**
 * The Requests page: KPIs, then four charts in a 2x2 grid sized by the page (container
 * queries), each filling its card so a row ends on one line, then the Routes card.
 */
function RequestsPage({ isLoading = false }: { isLoading?: boolean }) {
  const small = {
    data: requestsByHour,
    height: 'fill',
    xLabels: 'edges',
    showYAxis: false,
    isLoading,
  } as const;
  return (
    <div className="grid content-start gap-4">
      <Kpis isLoading={isLoading} />
      <div className="@container">
        <div className="grid gap-4 @2xl:grid-cols-2">
          <Card
            title="Requests"
            description="Requests per hour, against the previous period"
            summary={{ value: count(totals.requests), label: 'requests' }}
            isLoading={isLoading}
          >
            <MetricsLineChart {...small} series={requestsVsPreviousSeries} valueFormatter={count} />
          </Card>
          <Card
            title="Error rate"
            description="Share of requests that failed"
            summary={{ value: percent(totals.errorRate), label: '5xx rate' }}
            isLoading={isLoading}
          >
            <MetricsLineChart
              {...small}
              series={errorRateSeries.map(s => ({ ...s, emphasis: s.dataKey === 'errorRate' }))}
              valueFormatter={percent}
            />
          </Card>
          <Card
            title="Latency"
            description="Edge duration percentiles"
            summary={{ value: ms(mean('p95')), label: 'P95' }}
            isLoading={isLoading}
          >
            <MetricsLineChart
              {...small}
              series={percentileSeries.map(s => ({ ...s, emphasis: s.dataKey === 'p95' }))}
              valueFormatter={ms}
            />
          </Card>
          <Card
            title="Cold starts"
            description="Requests that woke a stopped app"
            summary={{ value: String(totals.coldStarts), label: 'cold starts' }}
            isLoading={isLoading}
          >
            <MetricsStackedBarChart
              {...small}
              series={coldStartSeries}
              valueFormatter={count}
              overlay={{ dataKey: 'wakeMs', label: 'Avg wake time', color: 'var(--chart-blue)', valueFormatter: ms }}
            />
          </Card>
        </div>
      </div>
      <RoutesCard isLoading={isLoading} />
    </div>
  );
}

/** The final Requests page composition. Resize the canvas: the charts go 2x2 to one column. */
export const RequestsOverview: Story = { render: () => <RequestsPage /> };

/** The same page while every query loads: KPI, summary, chart and list skeletons in place. */
export const Loading: Story = { render: () => <RequestsPage isLoading /> };
