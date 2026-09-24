import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, LogsIcon } from 'lucide-react';
import { fn } from 'storybook/test';

import { Button } from '../Button/Button';
import { MetricsCard } from '../MetricsCard';
import { Tab, TabContent, TabList, Tabs } from '../Tabs';
import { MetricsLineChart } from './metrics-line-chart';
import type { MetricsLineChartSeries } from './metrics-line-chart';

const data: Record<string, unknown>[] = [
  { time: '09:00', requests: 52_000, errors: 3 },
  { time: '10:00', requests: 184_000, errors: 47 },
  { time: '11:00', requests: 97_000, errors: 12 },
  { time: '12:00', requests: 412_000, errors: 88 },
  { time: '13:00', requests: 596_000, errors: 21 },
  { time: '14:00', requests: 238_000, errors: 100 },
  { time: '15:00', requests: 341_000, errors: 0 },
];

const total = (key: string) => (points: Record<string, unknown>[]) => ({
  value: String(points.reduce((sum, point) => sum + (typeof point[key] === 'number' ? point[key] : 0), 0)),
  suffix: 'total',
});

const series = [
  { dataKey: 'requests', label: 'Requests', color: 'var(--chart-blue)', aggregate: total('requests') },
  { dataKey: 'errors', label: 'Errors', color: 'var(--chart-red)', aggregate: total('errors') },
] satisfies MetricsLineChartSeries[];

const meta: Meta<typeof MetricsLineChart> = {
  title: 'Metrics/MetricsLineChart',
  component: MetricsLineChart,
  parameters: { layout: 'centered' },
  args: {
    data,
    series,
    height: 260,
    onPointClick: fn(),
    xAxisInterval: 'preserveStartEnd',
    xAxisMinTickGap: 28,
  },
};

export default meta;
type Story = StoryObj<typeof MetricsLineChart>;

export const MultipleSeries: Story = {
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

export const SinglePoint: Story = {
  args: {
    data: [{ time: 'Now', requests: 42 }],
    series: [{ dataKey: 'requests', label: 'Requests', color: 'var(--chart-blue)' }],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

const latencyData: Record<string, unknown>[] = [
  { time: '09:00', p50: 120, p95: 480 },
  { time: '10:00', p50: 135, p95: 520 },
  { time: '11:00', p50: 110, p95: 390 },
  { time: '12:00', p50: 160, p95: 710 },
  { time: '13:00', p50: 145, p95: 640 },
  { time: '14:00', p50: 128, p95: 455 },
  { time: '15:00', p50: 138, p95: 560 },
];

const latencySeries = [
  { dataKey: 'p50', label: 'p50', color: 'var(--chart-green)' },
  { dataKey: 'p95', label: 'p95', color: 'var(--chart-orange)' },
] satisfies MetricsLineChartSeries[];

export const InMetricsCardWithTabs: Story = {
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Traffic" description="Requests, errors and latency per hour." />
          <MetricsCard.Summary value="1.52M" label="Total requests" />
          <MetricsCard.Actions>
            <Button variant="ghost" size="icon-md" tooltip="View in Traces" aria-label="View in Traces">
              <EyeIcon />
            </Button>
            <Button variant="ghost" size="icon-md" tooltip="View errors in Logs" aria-label="View errors in Logs">
              <LogsIcon />
            </Button>
          </MetricsCard.Actions>
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <Tabs defaultTab="volume" className="overflow-visible">
            <TabList>
              <Tab value="volume">Volume</Tab>
              <Tab value="latency">Latency</Tab>
            </TabList>
            <TabContent value="volume" className="pt-3">
              <MetricsLineChart {...args} />
            </TabContent>
            <TabContent value="latency" className="pt-3">
              <MetricsLineChart {...args} data={latencyData} series={latencySeries} />
            </TabContent>
          </Tabs>
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};

export const FixedDomain: Story = {
  args: {
    data: [
      { time: 'Mon', score: 0.72 },
      { time: 'Tue', score: 0.81 },
      { time: 'Wed', score: 0.76 },
      { time: 'Thu', score: 0.93 },
    ],
    series: [{ dataKey: 'score', label: 'Answer relevancy', color: 'var(--chart-purple)' }],
    yDomain: [0, 1],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};
