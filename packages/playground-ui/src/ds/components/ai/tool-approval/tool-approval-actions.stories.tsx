import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ToolApprovalActions } from './tool-approval';

const meta = {
  title: 'AI/Tool Approval Actions',
  component: ToolApprovalActions,
  args: { toolName: 'write_file', onApprove: fn(), onDecline: fn() },
  argTypes: {
    toolName: { description: 'Adds tool context to the accessible button names. Visible labels stay short.' },
    disabled: { description: 'Blocks both actions while a decision is in flight.', control: 'boolean' },
    status: {
      description: 'The consumer decision. Both actions stay disabled even when disabled is false.',
      control: 'select',
      options: [undefined, 'approved', 'declined'],
    },
    autoFocus: { description: 'Opts into focusing Approve on mount.', control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The same actions render inside Factory approval cards and Studio tool details. Clicking emits a callback. The consumer supplies disabled and decision status, including any optimistic update or rollback. Clearing both re-enables the actions. Requests and error feedback belong to the consumer; a displayed decision does not prove server confirmation.',
      },
    },
  },
} satisfies Meta<typeof ToolApprovalActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Approve ${args.toolName}` }));
    await userEvent.click(canvas.getByRole('button', { name: `Decline ${args.toolName}` }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
    await expect(args.onDecline).toHaveBeenCalledOnce();
  },
};

export const Submitting: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: `Approve ${args.toolName}` })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: `Decline ${args.toolName}` })).toBeDisabled();
  },
};

export const Approved: Story = { args: { status: 'approved', disabled: false }, play: Submitting.play };
export const Declined: Story = { args: { status: 'declined', disabled: false }, play: Submitting.play };

export const Keyboard: Story = {
  args: { autoFocus: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: `Approve ${args.toolName}` })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: `Decline ${args.toolName}` })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onDecline).toHaveBeenCalledOnce();
    await expect(args.onApprove).not.toHaveBeenCalled();
  },
};

export const WithoutToolName: Story = {
  args: { toolName: undefined },
  parameters: {
    docs: { description: { story: 'Generic action labels are supported; both apps supply toolName for context.' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Approve' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeEnabled();
  },
};
