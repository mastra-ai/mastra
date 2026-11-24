import type { Meta, StoryObj } from '@storybook/react-vite';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card';
import { ScrollArea } from '@/ds/components/ScrollArea';

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
      <HoverCardTrigger className="cursor-help text-body text-foreground underline">Hover me</HoverCardTrigger>
      <HoverCardContent>This content appears when the trigger is hovered or focused.</HoverCardContent>
    </HoverCard>
  ),
};

export const WithButtonTrigger: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger render={<button type="button" />} className="cursor-help text-body text-foreground underline">
        Agent details
      </HoverCardTrigger>
      <HoverCardContent>Details are available on hover or keyboard focus.</HoverCardContent>
    </HoverCard>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="cursor-help text-body text-foreground underline">Weather Agent</HoverCardTrigger>
      <HoverCardContent className="text-left">
        <div className="text-caption text-foreground">Weather Agent</div>
        <p className="mt-1 text-meta text-muted-foreground">
          Answers questions about current conditions and forecasts using a weather tool.
        </p>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const BottomNoArrow: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="cursor-help text-body text-foreground underline">Open below</HoverCardTrigger>
      <HoverCardContent side="bottom" showArrow={false}>
        Positioned below the trigger, without an arrow.
      </HoverCardContent>
    </HoverCard>
  ),
};

/** Long content scrolls inside the card; the scrollbar stays clear of the rounded corners. */
export const LongContent: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger className="cursor-help text-body text-foreground underline">Long reason</HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="max-w-100 p-0">
        <ScrollArea maxHeight="20rem">
          <div className="grid gap-2 px-3 py-2.5">
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i}>Reason {i + 1}: the answer names its source and stays on the question that was asked.</p>
            ))}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  ),
};
