import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsLineChart } from '../MetricsLineChart';
import { MetricsStackedBarChart } from '../MetricsStackedBarChart';
import { MetricsCard } from './metrics-card';
import { count, ms, percentileSeries, requestsByHour, statusSeries } from './metrics-story-data';

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
