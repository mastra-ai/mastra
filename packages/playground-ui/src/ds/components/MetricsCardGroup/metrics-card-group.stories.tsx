import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon, CoinsIcon, HashIcon } from 'lucide-react';
import { MetricsKpiCard } from '../MetricsKpiCard';
import { MetricsCardGroup } from './metrics-card-group';

const meta: Meta<typeof MetricsCardGroup> = {
  title: 'Metrics/MetricsCardGroup',
  component: MetricsCardGroup,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsCardGroup>;

const kpis = [
  { label: 'Agent runs', value: '12.3k', changePct: 15.3, prevValue: '10.7k' },
  { label: 'Model cost', value: '$75.21', changePct: -45.3, prevValue: '$137.52', lowerIsBetter: true },
  { label: 'Tokens', value: '8.2M', changePct: -12.5, prevValue: '9.4M' },
];

export const KpiCards: Story = {
  render: args => (
    <MetricsCardGroup {...args}>
      {kpis.map(({ label, value, ...change }) => (
        <MetricsKpiCard key={label}>
          <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
          <MetricsKpiCard.ValueRow>
            <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value>
            <MetricsKpiCard.Change comparison="vs previous 24h" {...change} />
            <MetricsKpiCard.Prev value={change.prevValue} />
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
        <MetricsKpiCard.Label icon={<BotIcon />}>Agent runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>12.3k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10.7k" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="41 runs today" prevValue="10.7k" />
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<CoinsIcon />}>Model cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Loading />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<HashIcon />}>Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2M</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Threads</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Error />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </MetricsCardGroup>
  ),
};
