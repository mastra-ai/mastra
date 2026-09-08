import type { Meta, StoryObj } from '@storybook/react-vite';
import { TooltipProvider } from '../Tooltip';
import { HorizontalBars } from './horizontal-bars';

const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

const singleSegment = [{ label: 'Requests', color: '#6366f1' }];

const stackedSegments = [
  { label: 'Input', color: '#3b82f6' },
  { label: 'Output', color: '#93c5fd' },
];

const singleData = [
  { name: 'chef-agent', values: [4200] },
  { name: 'eval-agent', values: [3100] },
  { name: 'search-agent', values: [1800] },
  { name: 'billing-agent', values: [900] },
  { name: 'moderation-agent', values: [400] },
];

const statusSegments = [
  { label: 'Completed', color: 'var(--neutral3)' },
  { label: 'Running', color: '#facc15' },
  { label: 'Pending', color: '#fb923c' },
  { label: 'Failed', color: '#f87171' },
];

const statusData = [
  { name: 'travel-questions', values: [0, 10, 0, 0] },
  { name: 'geo-questions', values: [2, 0, 5, 0] },
  { name: 'support-tickets', values: [0, 0, 0, 4] },
  { name: 'billing-faq', values: [3, 0, 0, 0] },
];

const stackedData = [
  { name: 'chef-agent', values: [2800, 1400] },
  { name: 'eval-agent', values: [1900, 1200] },
  { name: 'search-agent', values: [1200, 600] },
  { name: 'billing-agent', values: [600, 300] },
  { name: 'moderation-agent', values: [250, 150] },
];

const meta: Meta<typeof HorizontalBars> = {
  title: 'Metrics/HorizontalBars',
  component: HorizontalBars,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HorizontalBars>;

export const Default: Story = {
  render: () => (
    <div style={{ width: '30rem', height: 300 }}>
      <HorizontalBars data={singleData} segments={singleSegment} maxVal={4200} fmt={fmt} />
    </div>
  ),
};

export const Stacked: Story = {
  render: () => (
    <div style={{ width: '30rem', height: 300 }}>
      <HorizontalBars data={stackedData} segments={stackedSegments} maxVal={4200} fmt={fmt} />
    </div>
  ),
};

/** Bright fills (yellow, orange, red) render at full opacity in dark mode; the label must stay readable on them. */
export const BrightSegments: Story = {
  render: () => (
    <div style={{ width: '30rem', height: 300 }}>
      <HorizontalBars data={statusData} segments={statusSegments} maxVal={10} fmt={fmt} />
    </div>
  ),
};
