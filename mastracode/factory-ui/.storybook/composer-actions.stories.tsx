import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ComposerActionRow } from '../src/ui/domains/chat/components/ComposerActionRow';

const meta = {
  title: 'Applications/Factory/Composer actions',
  component: ComposerActionRow,
  args: { children: null, sendDisabled: false, onAttach: fn() },
} satisfies Meta<typeof ComposerActionRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Disabled: Story = {
  args: { attachDisabled: true, sendDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Attach image' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeDisabled();
  },
};
export const Streaming: Story = {
  args: { onAbort: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Abort' }));
    await expect(args.onAbort).toHaveBeenCalledOnce();
  },
};
