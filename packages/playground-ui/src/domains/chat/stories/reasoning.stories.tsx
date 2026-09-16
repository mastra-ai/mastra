import type { ReasoningPart } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ReasoningPartRenderer } from '../messages/renderers/reasoning-part-renderer';

const meta = {
  title: 'AI/Reasoning',
  component: ReasoningPartRenderer,
  parameters: {
    docs: {
      description: {
        component: 'Studio reasoning states. Factory currently renders reasoning as inline italic Markdown.',
      },
    },
  },
} satisfies Meta<typeof ReasoningPartRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const streamingPart = {
  type: 'reasoning',
  reasoning: '',
  state: 'streaming',
} satisfies ReasoningPart & { state: 'streaming' };

const redactedPart = {
  type: 'reasoning',
  reasoning: '',
  redacted: true,
} satisfies ReasoningPart & { redacted: boolean };

export const Reloaded: Story = {
  args: { part: { type: 'reasoning', reasoning: 'I will compare the two files before proposing a change.' } },
};

export const Collapsed: Story = {
  args: Reloaded.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Hide reasoning' }));
    await expect(canvas.getByRole('button', { name: 'Show reasoning' })).toBeVisible();
    await expect(canvas.queryByText(Reloaded.args.part.reasoning)).not.toBeInTheDocument();
  },
};

export const WaitingForText: Story = {
  args: { part: streamingPart },
};

export const StreamingText: Story = {
  args: { part: { ...streamingPart, reasoning: 'The first file contains' } },
};

export const Redacted: Story = {
  args: { part: redactedPart },
};

export const EmptyCompleted: Story = {
  args: { part: { type: 'reasoning', reasoning: '' } },
  parameters: { docs: { description: { story: 'Intentionally blank: no empty panel or reasoning toggle.' } } },
};
