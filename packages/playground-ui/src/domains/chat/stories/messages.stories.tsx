import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageText } from '../messages/renderers/message-text';

const meta = {
  title: 'Chat/Message Text',
  component: MessageText,
  args: { metadata: undefined },
  parameters: {
    docs: {
      description: {
        component:
          'Real Studio text renderer at fixed points in a response. Studio and Factory consumer tests cover message ordering and reveal pacing.',
      },
    },
  },
} satisfies Meta<typeof MessageText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reloaded: Story = {
  args: {
    text: 'The review is complete.\n\n- Messages stay in order.\n- `review-notes.txt` is available in the conversation.\n\n| State | Result |\n| --- | --- |\n| Reloaded | Preserved |\n| Streaming | In progress |',
  },
};

export const StreamingMarkdown: Story = {
  args: { text: 'I found **two files** to review:\n\n- `src/agent.ts`\n- **src/tools', streaming: true },
};

export const Error: Story = {
  args: { text: 'The model provider could not complete the response.', metadata: { status: 'error' } },
};

export const Warning: Story = {
  args: { text: 'The response reached the configured step limit.', metadata: { status: 'warning' } },
};

export const BlockedWithDetails: Story = {
  args: {
    text: 'The response was blocked by the output processor.',
    metadata: {
      status: 'tripwire',
      tripwire: {
        reason: 'Restricted content',
        processorId: 'output-guard',
        retry: false,
        metadata: { category: 'policy' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Details' }));
    await waitFor(() => expect(canvas.getByText('Not allowed')).toBeVisible());
    await expect(canvas.getByText('output-guard')).toBeVisible();
  },
};
