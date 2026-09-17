import { ComposerAttachmentButton } from '@mastra/playground-ui/components/Composer';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ComposerActionRow } from '../src/lib/ai-ui/composer-action-row';

const meta = {
  title: 'Applications/Studio/Composer actions',
  component: ComposerActionRow,
  args: {
    isEmpty: false,
    isRunning: false,
    canSendWhileStreaming: false,
    onCancel: fn(),
    children: <ComposerAttachmentButton tooltip="Add attachment" />,
  },
} satisfies Meta<typeof ComposerActionRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Empty: Story = { args: { isEmpty: true } };
export const NoPermission: Story = {
  args: { canExecute: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Add attachment' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'No permission to execute' })).toBeDisabled();
  },
};
export const Streaming: Story = {
  args: { isRunning: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledOnce();
  },
};
export const Interjection: Story = {
  args: { isRunning: true, canSendWhileStreaming: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  },
};
