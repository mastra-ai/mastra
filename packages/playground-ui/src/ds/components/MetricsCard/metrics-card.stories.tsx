import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, LogsIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { MetricsLineChart } from '../MetricsLineChart';
import { MetricsShareList } from '../MetricsShareList';
import type { MetricsShareListColumn, MetricsShareListRow } from '../MetricsShareList';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { Tab, TabList, Tabs } from '../Tabs';
import { Txt } from '../Txt';
import { MetricsCard } from './metrics-card';
import { count, ms, percent, percentileSeries, requestsByHour, routeStats, statusSeries } from './metrics-story-data';
import type { RouteStat } from './metrics-story-data';

const meta: Meta<typeof MetricsCard> = {
  title: 'Metrics/MetricsCard',
  component: MetricsCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsCard>;

/** The common case: a stacked bar chart with its legend, under a title and a summary. */
export const Default: Story = {
  render: () => (
    <div style={{ width: '48rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Requests" description="Responses by status class." />
          <MetricsCard.Summary value="64.5K" label="requests" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsStackedBarChart data={requestsByHour} series={statusSeries} valueFormatter={count} height={240} />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

/** A line chart: latency percentiles on the sequential ramp. */
export const WithLineChart: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Latency" description="Edge duration percentiles." />
          <MetricsCard.Summary value="2.6s" label="P95" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsLineChart data={requestsByHour} series={percentileSeries} valueFormatter={ms} height={200} />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Latency" description="Hourly p50 and p95 latency." />
        </MetricsCard.TopBar>
        <MetricsCard.Loading />
      </MetricsCard>
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Scores" description="Evaluation scorer performance." />
        </MetricsCard.TopBar>
        <MetricsCard.Error message="Failed to fetch scores data" />
      </MetricsCard>
    </div>
  ),
};

export const NoData: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Trace Volume" description="Runs and call counts." />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsCard.NoData message="No trace volume data yet" />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

/** Capped single-series bars (one value per column), with the total as the summary. */
export const WithSummary: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription
            title="Cold starts"
            description="Requests that woke a stopped environment."
          />
          <MetricsCard.Summary value="178" label="cold starts" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsStackedBarChart
            data={requestsByHour}
            series={[{ dataKey: 'coldStarts', label: 'Cold starts', color: 'var(--chart-cyan)' }]}
            variant="capped"
            showLegend={false}
            height={200}
          />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription>
            <MetricsCard.Title>Custom Title</MetricsCard.Title>
            <MetricsCard.Description>Custom description with children pattern</MetricsCard.Description>
          </MetricsCard.TitleAndDescription>
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsLineChart
            data={requestsByHour}
            series={percentileSeries.slice(0, 1)}
            valueFormatter={ms}
            showLegend={false}
            height={160}
          />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

type Lens = 'busiest' | 'failing';

const LENSES: Record<
  Lens,
  {
    valueLabel: string;
    share: (r: RouteStat) => number;
    value: (r: RouteStat) => string;
    cell: (r: RouteStat) => string;
    column: MetricsShareListColumn;
  }
> = {
  busiest: {
    valueLabel: 'Requests',
    share: r => r.requests,
    value: r => count(r.requests),
    column: { label: 'P95', width: 'w-14' },
    cell: r => ms(r.p95),
  },
  failing: {
    valueLabel: '5xx',
    share: r => r.e5xx,
    value: r => count(r.e5xx),
    column: { label: '5xx rate', width: 'w-16' },
    cell: r => percent(r.e5xx / r.requests),
  },
};

function RoutesToolbarCard() {
  const [lens, setLens] = useState<Lens>('busiest');
  const spec = LENSES[lens];
  const columns = [spec.column];
  const rows: MetricsShareListRow[] = routeStats
    .filter(r => spec.share(r) > 0)
    .map(r => ({
      key: `${r.method} ${r.path}`,
      label: (
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Txt as="span" variant="body-sm" font="mono" tone="faint" className="w-14 shrink-0">
            {r.method}
          </Txt>
          <Txt as="span" variant="body-sm" font="mono" tone="ink" className="truncate">
            {r.path}
          </Txt>
        </span>
      ),
      title: `${r.method} ${r.path}`,
      share: spec.share(r),
      value: spec.value(r),
      cells: [spec.cell(r)],
    }));
  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Routes" description="Grouped by method and route." />
        <MetricsCard.Summary value={String(routeStats.length)} label="routes" />
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex flex-col gap-4 overflow-visible">
        <MetricsCard.Toolbar>
          <Tabs<Lens> value={lens} onValueChange={setLens} defaultTab="busiest">
            <TabList variant="pill-ghost" size="sm">
              <Tab value="busiest">Busiest</Tab>
              <Tab value="failing">Failing</Tab>
            </TabList>
          </Tabs>
          <MetricsShareList.Header columns={columns} valueLabel={spec.valueLabel} valueWidth="w-16" />
        </MetricsCard.Toolbar>
        <MetricsShareList
          key={lens}
          rows={rows}
          columns={columns}
          valueLabel={spec.valueLabel}
          valueWidth="w-16"
          showHeader={false}
          palette="hues"
          limit={6}
          overflow="more"
        />
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/**
 * `MetricsCard.Toolbar`: one row under the top bar, first child left, last child right. Here
 * small ghost tabs (`TabList variant="pill-ghost" size="sm"`) pick the question, and the list's
 * column headers (`MetricsShareList.Header`) sit beside them, so the list drops its own header
 * (`showHeader={false}`).
 */
export const Toolbar: Story = {
  render: () => (
    <div style={{ width: '44rem' }}>
      <RoutesToolbarCard />
    </div>
  ),
};

/**
 * `MetricsCard.Actions reveal="hover"`: the buttons appear while the card is hovered or one of
 * them has focus, so a page of cards doesn't read as a page of buttons. Hover the card.
 */
export const ActionsOnHover: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Latency" description="Edge duration percentiles." />
          <MetricsCard.Actions reveal="hover">
            <Button variant="ghost" size="icon-md" tooltip="View in Traces">
              <EyeIcon />
            </Button>
            <Button variant="ghost" size="icon-md" tooltip="View errors in Logs">
              <LogsIcon />
            </Button>
          </MetricsCard.Actions>
          <MetricsCard.Summary value="2.6s" label="P95" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsLineChart
            data={requestsByHour}
            series={percentileSeries}
            valueFormatter={ms}
            showYAxis={false}
            height={200}
          />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

/**
 * `MetricsCard.Summary isLoading`: skeletons in the value's and label's line boxes, so the top
 * bar keeps its height when the numbers land. Pairs with the chart's own `isLoading`.
 */
export const LoadingSummary: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Latency" description="Edge duration percentiles." />
          <MetricsCard.Summary value="2.6s" label="P95" isLoading />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsLineChart data={requestsByHour} series={percentileSeries} height={200} showYAxis={false} isLoading />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};
