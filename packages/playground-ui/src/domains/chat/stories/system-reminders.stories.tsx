import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { UserTextPartRenderer } from '../messages/renderers/user-text-part-renderer';

const meta = {
  title: 'Chat/System Reminders',
  component: UserTextPartRenderer,
  args: {
    part: {
      type: 'text',
      text: '<system-reminder path="/repo/AGENTS.md">Keep changes scoped to the requested package.</system-reminder>',
    },
  },
} satisfies Meta<typeof UserTextPartRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /System reminder/ }));
    await expect(canvas.getByText('Keep changes scoped to the requested package.')).toBeVisible();
  },
};
