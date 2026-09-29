import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ReasoningActivity } from './reasoning-activity';

const meta = {
  title: 'AI/Activity/Reasoning',
  component: ReasoningActivity,
  parameters: {
    docs: {
      description: {
        component:
          'Preset over `ActivityItem` for model reasoning, shared by Studio and Factory: a Markdown body, a busy line with no disclosure while it streams without text, and the provider redaction notice.',
      },
    },
  },
} satisfies Meta<typeof ReasoningActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reloaded: Story = {
  args: { text: 'I will compare the two files before proposing a change.' },
};

export const Collapsed: Story = {
  args: Reloaded.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Reasoning' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByText(Reloaded.args.text)).not.toBeInTheDocument();
  },
};

export const WaitingForText: Story = {
  args: { text: '', streaming: true },
};

export const StreamingText: Story = {
  args: { text: 'The first file contains', streaming: true },
};

export const Redacted: Story = {
  args: { text: '', redacted: true },
};

export const EmptyCompleted: Story = {
  args: { text: '' },
  parameters: { docs: { description: { story: 'Intentionally blank: no empty panel or reasoning toggle.' } } },
};

export const Markdown: Story = {
  args: {
    text: 'I will check **streaming behavior** before changing `agent.stream()`.\n\n- Read [the documentation](https://mastra.ai/docs).\n- Preserve existing callbacks.\n\n```ts\nconst result = await agent.stream(messages, { memory: { thread: "thread-1", resource: "user-1" } });\n```',
  },
};
