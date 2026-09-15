import type { Meta, StoryObj } from '@storybook/react-vite';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card';

const meta: Meta<typeof HoverCard> = {
  title: 'Elements/HoverCard',
  component: HoverCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof HoverCard>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="text-ui-md text-neutral6 cursor-help underline">Hover me</HoverCardTrigger>
      <HoverCardContent>This content appears when the trigger is hovered or focused.</HoverCardContent>
    </HoverCard>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="text-ui-md text-neutral6 cursor-help underline">Weather Agent</HoverCardTrigger>
      <HoverCardContent className="text-left">
        <div className="text-ui-sm text-neutral6">Weather Agent</div>
        <p className="text-ui-xs text-neutral4 mt-1">
          Answers questions about current conditions and forecasts using a weather tool.
        </p>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const BottomNoArrow: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="text-ui-md text-neutral6 cursor-help underline">Open below</HoverCardTrigger>
      <HoverCardContent side="bottom" showArrow={false}>
        Positioned below the trigger, without an arrow.
      </HoverCardContent>
    </HoverCard>
  ),
};
