import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompactNumber } from '../CompactNumber';
import { MetricsKpiCard } from './metrics-kpi-card';
import { IconCoins } from '@/ds/icons/central/IconCoins';
import { IconGauge } from '@/ds/icons/central/IconGauge';
import { IconHashtag } from '@/ds/icons/central/IconHashtag';
import { IconRobot } from '@/ds/icons/central/IconRobot';

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
        <MetricsKpiCard.Label icon={<IconRobot />}>Agent runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
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
        <MetricsKpiCard.Label icon={<IconHashtag />}>Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-12.5} prevValue="9.4k" />
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
        <MetricsKpiCard.Label icon={<IconCoins />}>Model cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={1284.37} currency="USD" />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-8.2} prevValue="$1,399.12" lowerIsBetter />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="claude-sonnet-5-5 most used" prevValue="$1,399.12" />
      </MetricsKpiCard>
    </div>
  ),
};

/** Nothing to compare against: the value stands alone. */
export const NoPreviousValue: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconGauge />}>Avg Score</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

export const GridOfCards: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconRobot />}>Agent runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="41 runs today" prevValue="10,676" />
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconCoins />}>Model cost</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconHashtag />}>Tokens</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>8.2k</MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={-12.5} prevValue="9.4k" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="62% input tokens" prevValue="9.4k" />
      </MetricsKpiCard>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconGauge />}>Avg Score</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>0.85</MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={3.1} prevValue="0.82" />
        </MetricsKpiCard.ValueRow>
        <MetricsKpiCard.Footer detail="128 scored runs" prevValue="0.82" />
      </MetricsKpiCard>
    </div>
  ),
};

/** Prior value without a detail line: it sits at the end of the value row, no hairline. */
export const PreviousValueInRow: Story = {
  render: () => (
    <div style={{ width: '20rem' }}>
      <MetricsKpiCard>
        <MetricsKpiCard.Label icon={<IconRobot />}>Agent runs</MetricsKpiCard.Label>
        <MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Value>
            <CompactNumber value={12310} />
          </MetricsKpiCard.Value>
          <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
          <MetricsKpiCard.Prev value="10,676" />
        </MetricsKpiCard.ValueRow>
      </MetricsKpiCard>
    </div>
  ),
};

/**
 * `isLoading` on `ValueRow` and `Footer`: skeletons in their own line boxes, so the card keeps
 * its height when the numbers land. The label stays; it doesn't depend on data. Shown next to a
 * loaded card for comparison.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {[true, false].map(isLoading => (
        <div key={String(isLoading)} style={{ width: '20rem' }}>
          <MetricsKpiCard>
            <MetricsKpiCard.Label icon={<IconRobot />}>Agent runs</MetricsKpiCard.Label>
            <MetricsKpiCard.ValueRow isLoading={isLoading}>
              <MetricsKpiCard.Value>
                <CompactNumber value={12310} />
              </MetricsKpiCard.Value>
              <MetricsKpiCard.Change comparison="vs previous 24h" changePct={15.3} prevValue="10,676" />
            </MetricsKpiCard.ValueRow>
            <MetricsKpiCard.Footer detail="41 runs today" prevValue="10,676" isLoading={isLoading} />
          </MetricsKpiCard>
        </div>
      ))}
    </div>
  ),
};
