import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  ToolCall,
  ToolCallArguments,
  ToolCallContent,
  ToolCallPresentedHeader,
  ToolCallTrigger,
  presentTool,
} from '../tool-call';
import { ToolApproval, ToolApprovalActions } from './tool-approval';

const toolArguments = { path: 'src/agent.ts' };

const meta = {
  title: 'AI/Tool Approval',
  component: ToolApproval,
  args: {
    toolName: 'write_file',
    onApprove: fn(),
    onDecline: fn(),
    children: <pre className="bg-sidebar text-caption overflow-auto rounded p-2">{JSON.stringify(toolArguments)}</pre>,
  },
  argTypes: {
    toolName: { description: 'Tool name shown in the heading and accessible action names.' },
    disabled: { description: 'Blocks both actions while the consumer submits a decision.', control: 'boolean' },
    status: {
      description: 'The consumer decision. Both actions remain disabled after submission finishes.',
      control: 'select',
      options: [undefined, 'approved', 'declined'],
    },
    autoFocus: { description: 'Focuses Approve on mount, as Factory does for a new request.', control: 'boolean' },
    children: { description: 'Consumer-provided tool details. Optional.', control: false },
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
          'Factory uses ToolApproval for standalone requests. Studio embeds ToolApprovalActions in its tool details. Both share the same actions, disabled states, and decision colors. Consumers own requests and decision status, including optimistic updates and rollback; these stories do not call an approval API.',
      },
    },
  },
} satisfies Meta<typeof ToolApproval>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: `Approve ${args.toolName}` }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
    await expect(args.onDecline).not.toHaveBeenCalled();
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

export const WithoutDetails: Story = { args: { children: undefined } };

export const Inline: Story = {
  name: 'Embedded in tool details',
  render: ({ children: _children, ...args }) => (
    <ToolCall defaultOpen aria-label={`Tool: ${args.toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader {...presentTool(args.toolName, toolArguments)} />
      </ToolCallTrigger>
      <ToolCallContent>
        <ToolCallArguments toolName={args.toolName} args={toolArguments} />
        <ToolApprovalActions {...args} />
      </ToolCallContent>
    </ToolCall>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Studio-style composition using the shared tool details and approval actions. The production Studio adapter supplies approval metadata, routing, and decision status.',
      },
    },
  },
  play: Pending.play,
};
