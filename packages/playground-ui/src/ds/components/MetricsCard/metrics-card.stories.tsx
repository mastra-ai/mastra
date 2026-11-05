import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, LogsIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { MetricsLineChart } from '../MetricsLineChart';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { ShareBar } from '../ShareBar';
import type { ShareBarColumn, ShareBarRow } from '../ShareBar';
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

/** The common case: a stacked bar chart with its legend, under a title and a total. */
export const Default: Story = {
  render: () => (
    <div style={{ width: '48rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.Title>Requests</MetricsCard.Title>
          <MetricsCard.Total value="64.5K" />
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
          <MetricsCard.Title>Latency</MetricsCard.Title>
          <MetricsCard.Total value="2.6s" />
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
          <MetricsCard.Title>Latency</MetricsCard.Title>
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
          <MetricsCard.Title>Scores</MetricsCard.Title>
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
          <MetricsCard.Title>Trace Volume</MetricsCard.Title>
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsCard.NoData message="No trace volume data yet" />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

/** Capped single-series bars (one value per column), with the total right of the title. */
export const WithTotal: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.Title>Cold starts</MetricsCard.Title>
          <MetricsCard.Total value="178" />
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
          <MetricsCard.Title>Latency</MetricsCard.Title>
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
    title: string;
    valueLabel: string;
    share: (r: RouteStat) => number;
    value: (r: RouteStat) => string;
    cell: (r: RouteStat) => string;
    column: ShareBarColumn;
  }
> = {
  busiest: {
    title: 'Busiest routes',
    valueLabel: 'Requests',
    share: r => r.requests,
    value: r => count(r.requests),
    column: { label: 'P95', width: 'w-14' },
    cell: r => ms(r.p95),
  },
  failing: {
    title: 'Failing routes',
    valueLabel: '5xx',
    share: r => r.e5xx,
    value: r => count(r.e5xx),
    column: { label: '5xx rate', width: 'w-16' },
    cell: r => percent(r.e5xx / r.requests),
  },
};

const LENS_OPTIONS = (Object.keys(LENSES) as Lens[]).map(value => ({ value, label: LENSES[value].title }));

function RoutesCard() {
  const [lens, setLens] = useState<Lens>('busiest');
  const spec = LENSES[lens];
  const columns = [spec.column];
  const rows: ShareBarRow[] = routeStats
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
        <MetricsCard.TitleMenu<Lens> title={spec.title} value={lens} onValueChange={setLens} options={LENS_OPTIONS} />
        <MetricsCard.Total value={String(routeStats.length)} />
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex flex-col gap-4 overflow-visible">
        <ShareBar
          key={lens}
          rows={rows}
          columns={columns}
          valueLabel={spec.valueLabel}
          valueWidth="w-16"
          palette="hues"
          limit={6}
          overflow="more"
        />
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/**
 * `MetricsCard.TitleMenu`: the title is a dropdown of the card's views, here the question for
 * the `ShareBar` under it.
 */
export const TitleMenu: Story = {
  render: () => (
    <div style={{ width: '44rem' }}>
      <RoutesCard />
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
          <MetricsCard.Title>Latency</MetricsCard.Title>
          <MetricsCard.Actions reveal="hover">
            <Button variant="ghost" size="icon-md" tooltip="View in traces">
              <EyeIcon />
            </Button>
            <Button variant="ghost" size="icon-md" tooltip="View errors in logs">
              <LogsIcon />
            </Button>
          </MetricsCard.Actions>
          <MetricsCard.Total value="2.6s" />
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
 * `MetricsCard.Total isLoading`: a skeleton in the value's line box, so the top bar keeps its
 * height when the number lands. Pairs with the chart's own `isLoading`.
 */
export const LoadingTotal: Story = {
  render: () => (
    <div style={{ width: '32rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.Title>Latency</MetricsCard.Title>
          <MetricsCard.Total value="2.6s" isLoading />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <MetricsLineChart data={requestsByHour} series={percentileSeries} height={200} showYAxis={false} isLoading />
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};
