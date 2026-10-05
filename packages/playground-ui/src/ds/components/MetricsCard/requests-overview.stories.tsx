import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityIcon, CircleAlertIcon, SnowflakeIcon, TimerIcon } from 'lucide-react';
import { MetricsCardGroup } from '../MetricsCardGroup';
import { MetricsKpiCard } from '../MetricsKpiCard';
import { MetricsLineChart } from '../MetricsLineChart';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { Cell, Row, Table, Tbody, Th, Thead } from '../Table';
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
  routes,
  statusSeries,
} from './metrics-story-data';

const meta: Meta = {
  title: 'Metrics/Examples/Requests Overview',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const total = (key: keyof (typeof requestsByHour)[number]) =>
  requestsByHour.reduce((sum, bucket) => sum + Number(bucket[key]), 0);
const totalRequests = total('2xx') + total('3xx') + total('4xx') + total('5xx');
const totalColdStarts = total('coldStarts');

const kpis = [
  {
    label: 'Requests',
    icon: <ActivityIcon />,
    value: count(totalRequests),
    changePct: 2.3,
    detail: '44.8 per minute',
    prev: '63.1K',
  },
  {
    label: 'Error rate',
    icon: <CircleAlertIcon />,
    value: '2.03%',
    changePct: 364,
    lowerIsBetter: true,
    detail: '1.31K server errors',
    prev: '0.44%',
  },
  {
    label: 'P95 latency',
    icon: <TimerIcon />,
    value: '2.62s',
    changePct: 8.1,
    lowerIsBetter: true,
    detail: 'P50 750ms',
    prev: '2.42s',
  },
  {
    label: 'Cold starts',
    icon: <SnowflakeIcon />,
    value: String(totalColdStarts),
    changePct: -13,
    lowerIsBetter: true,
    detail: 'Avg wake 2.12s',
    prev: '199',
  },
];

function ChartCard({
  title,
  description,
  summary,
  children,
}: {
  title: string;
  description: string;
  summary: { value: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title={title} description={description} />
        <MetricsCard.Summary value={summary.value} label={summary.label} />
      </MetricsCard.TopBar>
      <MetricsCard.Content>{children}</MetricsCard.Content>
    </MetricsCard>
  );
}

/** The full Requests page composition: KPIs, one big chart, a row of three, the routes table. */
export const RequestsOverview: Story = {
  render: () => (
    <div className="grid gap-4">
      <MetricsCardGroup>
        {kpis.map(kpi => (
          <MetricsKpiCard key={kpi.label}>
            <MetricsKpiCard.Label icon={kpi.icon}>{kpi.label}</MetricsKpiCard.Label>
            <MetricsKpiCard.ValueRow>
              <MetricsKpiCard.Value>{kpi.value}</MetricsKpiCard.Value>
              <MetricsKpiCard.Change changePct={kpi.changePct} prevValue={kpi.prev} lowerIsBetter={kpi.lowerIsBetter} />
            </MetricsKpiCard.ValueRow>
            <MetricsKpiCard.Footer detail={kpi.detail} prevValue={kpi.prev} />
          </MetricsKpiCard>
        ))}
      </MetricsCardGroup>

      <ChartCard
        title="Requests"
        description="Responses by status class."
        summary={{ value: count(totalRequests), label: 'requests' }}
      >
        <MetricsStackedBarChart data={requestsByHour} series={statusSeries} valueFormatter={count} height={260} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Error rate"
          description="Share of requests that failed."
          summary={{ value: '2.03%', label: '5xx rate' }}
        >
          <MetricsLineChart data={requestsByHour} series={errorRateSeries} valueFormatter={percent} height={180} />
        </ChartCard>
        <ChartCard title="Latency" description="Edge duration percentiles." summary={{ value: '2.62s', label: 'P95' }}>
          <MetricsLineChart data={requestsByHour} series={percentileSeries} valueFormatter={ms} height={180} />
        </ChartCard>
        <ChartCard
          title="Cold starts"
          description="Requests that woke a stopped environment."
          summary={{ value: String(totalColdStarts), label: 'cold starts' }}
        >
          <MetricsStackedBarChart data={requestsByHour} series={coldStartSeries} variant="capped" height={180} />
        </ChartCard>
      </div>

      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Routes" description="Grouped by method and route." />
          <MetricsCard.Summary value={String(routes.length)} label="routes" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <Table size="small">
            <Thead>
              <Th>Route</Th>
              <Th className="text-right">Requests</Th>
              <Th className="text-right">5xx rate</Th>
              <Th className="text-right">P95</Th>
            </Thead>
            <Tbody>
              {routes.map(route => (
                <Row key={`${route.method} ${route.path}`}>
                  <Cell>
                    <span className="flex min-w-0 items-center gap-2">
                      <Txt as="span" variant="caption" font="mono" tone="muted" className="w-11 shrink-0">
                        {route.method}
                      </Txt>
                      <Txt as="span" variant="body-sm" font="mono" className="truncate">
                        {route.path}
                      </Txt>
                    </span>
                  </Cell>
                  <Cell className="tabular-nums [&>div]:justify-end">{count(route.requests)}</Cell>
                  <Cell
                    className={`tabular-nums [&>div]:justify-end ${route.errorRate >= 0.01 ? 'text-destructive-foreground' : ''}`}
                  >
                    {percent(route.errorRate)}
                  </Cell>
                  <Cell className="tabular-nums [&>div]:justify-end">{ms(route.p95)}</Cell>
                </Row>
              ))}
            </Tbody>
          </Table>
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};
