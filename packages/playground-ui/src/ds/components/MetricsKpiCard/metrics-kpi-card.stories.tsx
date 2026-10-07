import type { Meta, StoryObj } from '@storybook/react-vite';
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
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Agent runs</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

export const WithNegativeChange: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Tokens</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-12.5} prevValue="9.4k" />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

export const LowerIsBetter: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Model cost</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-8.2} prevValue="$1,399.12" lowerIsBetter />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={1284.37} currency="USD" />
          </MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

export const NoChange: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Avg Score</MetricsKpiCard.Label>
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
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Agent runs</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label>Model cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
          <MetricsKpiCard.NoChange />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Tokens</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-12.5} prevValue="9.4k" />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Header>
          <MetricsKpiCard.Label>Avg Score</MetricsKpiCard.Label>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={3.1} prevValue="0.82" />
        </MetricsKpiCard.Header>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>0.85</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};
