import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsCard } from './metrics-card';

const meta: Meta<typeof MetricsCard> = {
  title: 'Metrics/MetricsCard',
  component: MetricsCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsCard>;

export const Default: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
          <MetricsCard.Summary value="$124.50" label="Total cost" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <p className="text-neutral2 text-sm">Chart or table content goes here</p>
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

export const WithSummary: Story = {
  render: () => (
    <div style={{ width: '30rem' }}>
      <MetricsCard>
        <MetricsCard.TopBar>
          <MetricsCard.TitleAndDescription
            title="Token Usage by Agent"
            description="Token consumption grouped by agent."
          />
          <MetricsCard.Summary value="45.2k" label="Total tokens" />
        </MetricsCard.TopBar>
        <MetricsCard.Content>
          <p className="text-neutral2 text-sm">Bar chart content goes here</p>
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
          <p className="text-neutral2 text-sm">Content area</p>
        </MetricsCard.Content>
      </MetricsCard>
    </div>
  ),
};
