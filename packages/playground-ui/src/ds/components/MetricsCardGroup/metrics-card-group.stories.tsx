import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsKpiCard } from '../MetricsKpiCard';
import { MetricsCardGroup } from './metrics-card-group';

const meta: Meta<typeof MetricsCardGroup> = {
  title: 'Metrics/MetricsCardGroup',
  component: MetricsCardGroup,
  parameters: {
    layout: 'padded',
  },
  args: {
    variant: 'default',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'inset'] },
  },
};

export default meta;
type Story = StoryObj<typeof MetricsCardGroup>;

const kpis = [
  { label: 'Total Agent Runs', value: '12.3k', changePct: 15.3, prevValue: '10.7k' },
  { label: 'Total Model Cost', value: '$75.21', changePct: -45.3, prevValue: '$137.52', lowerIsBetter: true },
  { label: 'Total Tokens', value: '8.2M', changePct: -12.5, prevValue: '9.4M' },
];

export const KpiCards: Story = {
  render: args => (
    <MetricsCardGroup {...args}>
      {kpis.map(({ label, value, ...change }) => (
        <MetricsKpiCard key={label}>
          <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
          <MetricsKpiCard.ValueRow>
            <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value>
            <MetricsKpiCard.Change {...change} />
          </MetricsKpiCard.ValueRow>
        </MetricsKpiCard>
      ))}
    </MetricsCardGroup>
  ),
};

export const MixedStates: Story = {
  render: args => (
    <MetricsCardGroup {...args}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Agent Runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>12.3k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={15.3} prevValue="10.7k" />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Model Cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Loading />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2M</MetricsKpiCard.Value>
          <MetricsKpiCard.NoChange />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Total Threads</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Error />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </MetricsCardGroup>
  ),
};
