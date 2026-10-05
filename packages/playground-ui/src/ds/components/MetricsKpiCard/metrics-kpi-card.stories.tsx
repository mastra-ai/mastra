import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon, CoinsIcon, GaugeIcon, HashIcon } from 'lucide-react';
import { CompactNumber } from '../CompactNumber';
import { MetricsKpiCard } from './metrics-kpi-card';

const meta: Meta<typeof MetricsKpiCard> = {
  title: 'Metrics/MetricsKpiCard',
  component: MetricsKpiCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsKpiCard>;

export const WithPositiveChange: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<BotIcon />}>Total Agent Runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={15.3} prevValue="10,676" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="41 runs today" prevValue="10,676" />
      </MetricsKpiCard>
    </div>
  ),
};

export const WithNegativeChange: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<HashIcon />}>Total Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={-12.5} prevValue="9.4k" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="62% input tokens" prevValue="9.4k" />
      </MetricsKpiCard>
    </div>
  ),
};

export const LowerIsBetter: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<CoinsIcon />}>Total Model Cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={1284.37} currency="USD" />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={-8.2} prevValue="$1,399.12" lowerIsBetter />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="claude-sonnet-5-5 most used" prevValue="$1,399.12" />
      </MetricsKpiCard>
    </div>
  ),
};

export const NoChange: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<GaugeIcon />}>Avg Score</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
          <MetricsKpiCard.NoChange />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

export const GridOfCards: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<BotIcon />}>Total Agent Runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={15.3} prevValue="10,676" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="41 runs today" prevValue="10,676" />
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<CoinsIcon />}>Total Model Cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
          <MetricsKpiCard.NoChange />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<HashIcon />}>Total Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={-12.5} prevValue="9.4k" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="62% input tokens" prevValue="9.4k" />
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<GaugeIcon />}>Avg Score</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>0.85</MetricsKpiCard.Value>
          <MetricsKpiCard.Change changePct={3.1} prevValue="0.82" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="128 scored runs" prevValue="0.82" />
      </MetricsKpiCard>
    </div>
  ),
};
