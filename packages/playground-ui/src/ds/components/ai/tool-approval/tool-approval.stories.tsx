import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ToolApproval, ToolApprovalActions } from './tool-approval';

const meta = {
  title: 'AI/Tool Approval',
  component: ToolApproval,
  args: {
    toolName: 'write_file',
    onApprove: fn(),
    onDecline: fn(),
    children: <pre className="bg-surface1 text-ui-sm overflow-auto rounded p-2">{'{"path":"src/agent.ts"}'}</pre>,
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Factory uses ToolApproval for standalone requests. Studio embeds ToolApprovalActions in its tool details. Both share the same actions, disabled states, and decision colors. Consumers own requests and supply confirmed status; these stories do not call an approval API.',
      },
    },
  },
} satisfies Meta<typeof ToolApproval>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const Submitting: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: `Approve ${args.toolName}` })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: `Decline ${args.toolName}` })).toBeDisabled();
  },
};

export const Approved: Story = { args: { status: 'approved' }, play: Submitting.play };
export const Declined: Story = { args: { status: 'declined' }, play: Submitting.play };

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

export const LongToolName: Story = {
  args: { toolName: 'workspace_production_database_migration_apply_pending_schema_changes' },
};

export const Inline: Story = {
  render: ({ children: _children, ...args }) => <ToolApprovalActions {...args} />,
};
