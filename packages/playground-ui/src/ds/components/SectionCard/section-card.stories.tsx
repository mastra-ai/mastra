import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionCard } from './section-card';

const meta: Meta<typeof SectionCard> = {
  title: 'Layout/SectionCard',
  component: SectionCard,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof SectionCard>;

export const Default: Story = {
  render: () => (
    <SectionCard title="Activity Over Time" description="Track request volume, cost, and latency over time">
      <p className="text-neutral3">Body content goes here.</p>
    </SectionCard>
  ),
};

export const WithAction: Story = {
  render: () => (
    <SectionCard
      title="Activity Over Time"
      description="Track request volume, cost, and latency over time"
      action={
        <div className="flex gap-2 text-ui-sm text-neutral3">
          <span>Cost</span>
          <span>Requests</span>
          <span>Tokens</span>
          <span>Errors</span>
        </div>
      }
    >
      <div className="h-40 rounded-md bg-surface3" />
    </SectionCard>
  ),
};

export const Danger: Story = {
  render: () => (
    <SectionCard
      variant="danger"
      title="Delete project"
      description="Irreversible. All data, deployments, and members will be removed."
    >
      <p className="text-accent2/80">Confirmation controls go here.</p>
    </SectionCard>
  ),
};

export const FillHeight: Story = {
  render: () => (
    <div className="grid h-[420px] grid-cols-2 gap-4">
      <SectionCard fillHeight title="Left" description="Stretches to grid row height">
        <div className="h-full rounded-md bg-surface3" />
      </SectionCard>
      <SectionCard fillHeight title="Right" description="Same height as sibling">
        <div className="h-full rounded-md bg-surface3" />
      </SectionCard>
    </div>
  ),
};
