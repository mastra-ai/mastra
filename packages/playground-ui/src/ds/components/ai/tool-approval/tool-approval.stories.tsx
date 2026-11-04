import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ToolApproval } from './tool-approval';
import type { ToolApprovalProps } from './tool-approval';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { ToolBadge } from '@/domains/chat/tools/badges/tool-badge';

const toolArguments = { path: 'src/agent.ts', content: 'export const agent = createAgent({ name: "Assistant" });' };

const meta = {
  title: 'AI/Tool Approval',
  component: ToolApproval,
  args: {
    toolName: 'write_file',
    args: toolArguments,
    onApprove: fn(),
    onDecline: fn(),
  },
  argTypes: {
    toolName: { description: 'Tool name shown in the heading and accessible action names.' },
    args: { description: 'Full tool arguments, rendered as shared tool details or a file preview.', control: 'object' },
    disabled: { description: 'Blocks both decisions while the consumer is busy.', control: 'boolean' },
    status: {
      description: 'A decision replaces the actions with a status badge. Clear it to allow another decision.',
      control: 'select',
      options: [undefined, 'approved', 'declined'],
    },
    autoFocus: { description: 'Focuses Approve on mount, as Factory does for a new request.', control: 'boolean' },
    children: { description: 'Optional custom details that replace the argument renderer.', control: false },
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
          'One approval component for Factory and Studio. ToolApproval frames a standalone request in the shared activity layout with the tool argument preview. Tools that already have their own activity compose the parts instead: ToolApprovalStatus beside the tool name, ToolApprovalActions in the details. Pending requests stay expanded; a decision removes the actions and the status stays visible when Studio details are collapsed. Consumers own requests, errors, and status (including optimistic updates and rollback). Studio integration examples below use the real tool badge and routing provider with callback spies; transport behavior is covered by application tests.',
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

export const Approved: Story = {
  args: { status: 'approved' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Approved');
    await expect(canvas.queryByRole('button', { name: `Approve ${args.toolName}` })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: `Decline ${args.toolName}` })).not.toBeInTheDocument();
  },
};

export const Declined: Story = {
  args: { status: 'declined' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Declined');
    await expect(canvas.queryByRole('button', { name: `Approve ${args.toolName}` })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: `Decline ${args.toolName}` })).not.toBeInTheDocument();
  },
};

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

export const WithoutDetails: Story = { args: { args: undefined } };

function InteractiveApproval(props: ToolApprovalProps) {
  const [status, setStatus] = useState<ToolApprovalProps['status']>();
  return (
    <ToolApproval
      {...props}
      status={status}
      onApprove={() => {
        props.onApprove();
        setStatus('approved');
      }}
      onDecline={() => {
        props.onDecline();
        setStatus('declined');
      }}
    />
  );
}

export const Decision: Story = {
  render: args => <InteractiveApproval {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Approve ${args.toolName}` }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
    await expect(canvas.getByRole('status')).toHaveTextContent('Approved');
    await expect(canvas.queryByRole('button', { name: `Decline ${args.toolName}` })).not.toBeInTheDocument();
  },
};

// Exercise Studio's real adapter here; its stream/generate/network dispatch is covered by its unit tests.
function StudioApproval({
  mode = 'stream',
  ...props
}: ToolApprovalProps & { mode?: 'stream' | 'generate' | 'network' }) {
  return (
    <ToolCallProvider
      approveToolcall={props.onApprove}
      declineToolcall={props.onDecline}
      approveToolcallGenerate={props.onApprove}
      declineToolcallGenerate={props.onDecline}
      approveNetworkToolcall={props.onApprove}
      declineNetworkToolcall={props.onDecline}
      isRunning={props.disabled ?? false}
      toolCallApprovals={props.status ? { 'write-file-1': { status: props.status } } : {}}
      networkToolCallApprovals={props.status ? { [`run-1-${props.toolName}`]: { status: props.status } } : {}}
    >
      <ToolBadge
        toolCallId="write-file-1"
        toolName={props.toolName}
        args={toolArguments}
        result={undefined}
        toolOutput={[]}
        toolCalled={false}
        toolApprovalMetadata={{
          toolCallId: 'write-file-1',
          toolName: props.toolName,
          args: toolArguments,
          runId: 'run-1',
        }}
        isNetwork={mode === 'network'}
        metadata={{ mode: mode === 'generate' ? 'generate' : 'stream' }}
      />
    </ToolCallProvider>
  );
}

export const EmbeddedInToolDetails: Story = {
  name: 'Embedded in tool details (Studio)',
  render: args => <StudioApproval {...args} />,
  play: async context => {
    const canvas = within(context.canvasElement);
    await expect(canvas.queryByRole('button', { expanded: true })).not.toBeInTheDocument();
    await expect(canvas.getByRole('status')).toHaveTextContent('Approval required');
    await Pending.play?.(context);
  },
};

export const StudioGenerate: Story = {
  render: args => <StudioApproval {...args} mode="generate" />,
  play: Pending.play,
};

export const StudioNetwork: Story = {
  render: args => <StudioApproval {...args} mode="network" />,
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: `Decline ${args.toolName}` }));
    await expect(args.onDecline).toHaveBeenCalledOnce();
    await expect(args.onApprove).not.toHaveBeenCalled();
  },
};

export const StudioSubmitting: Story = {
  args: { disabled: true },
  render: EmbeddedInToolDetails.render,
  play: Submitting.play,
};

export const StudioApproved: Story = {
  args: { status: 'approved' },
  render: EmbeddedInToolDetails.render,
  play: async context => {
    await Approved.play?.(context);
    const canvas = within(context.canvasElement);
    await userEvent.click(canvas.getByRole('button', { expanded: true }));
    await expect(canvas.getByRole('status')).toBeVisible();
    await expect(canvas.getByRole('button', { expanded: false })).toBeVisible();
  },
};

export const StudioNetworkDeclined: Story = {
  args: { status: 'declined' },
  render: StudioNetwork.render,
  play: Declined.play,
};
