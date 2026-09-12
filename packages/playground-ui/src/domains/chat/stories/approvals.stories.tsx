import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ToolCallProvider } from '../context/tool-call-context';
import type { ToolCallContextValue } from '../context/tool-call-context';
import { ToolApprovalButtons } from '../tools/badges/tool-approval-buttons';
import type { ToolApprovalButtonsProps } from '../tools/badges/tool-approval-buttons';

const contextValue = {
  approveToolcall: fn(),
  declineToolcall: fn(),
  approveToolcallGenerate: fn(),
  declineToolcallGenerate: fn(),
  approveNetworkToolcall: fn(),
  declineNetworkToolcall: fn(),
  isRunning: false,
  toolCallApprovals: {},
  networkToolCallApprovals: {},
} satisfies ToolCallContextValue;

const meta = {
  title: 'Chat/Tool Approvals',
  component: ToolApprovalButtons,
  args: {
    toolCallId: 'write-file-1',
    toolName: 'write_file',
    toolCalled: false,
    toolApprovalMetadata: {
      toolCallId: 'write-file-1',
      toolName: 'write_file',
      args: { path: 'src/agent.ts' },
      runId: 'run-1',
    },
    isNetwork: false,
    contextValue,
  },
  render: ({ contextValue, ...props }) => (
    <ToolCallProvider {...contextValue}>
      <ToolApprovalButtons {...props} />
    </ToolCallProvider>
  ),
  parameters: {
    docs: {
      description: {
        component:
          'Studio approval controls with their real provider. Callbacks are Storybook spies; these stories verify dispatch and disabled states, not API success, retry, or session recovery. Factory owns a separate ApprovalCard.',
      },
    },
  },
} satisfies Meta<ToolApprovalButtonsProps & { contextValue: ToolCallContextValue }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const StreamingApproval: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Approve' }));
    await expect(args.contextValue.approveToolcall).toHaveBeenCalledWith(args.toolCallId);
  },
};

export const GenerateApproval: Story = {
  args: { isGenerateMode: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Approve' }));
    await expect(args.contextValue.approveToolcallGenerate).toHaveBeenCalledWith(args.toolCallId);
  },
};

export const NetworkDecline: Story = {
  args: { isNetwork: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Decline' }));
    await expect(args.contextValue.declineNetworkToolcall).toHaveBeenCalledWith(args.toolName, 'run-1');
  },
};

export const Running: Story = {
  args: { contextValue: { ...contextValue, isRunning: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Approve' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeDisabled();
  },
};

export const Approved: Story = {
  args: { contextValue: { ...contextValue, toolCallApprovals: { 'write-file-1': { status: 'approved' } } } },
  play: Running.play,
};

export const NetworkDeclined: Story = {
  args: {
    isNetwork: true,
    contextValue: { ...contextValue, networkToolCallApprovals: { 'run-1-write_file': { status: 'declined' } } },
  },
  play: Running.play,
};

export const Executed: Story = {
  args: { toolCalled: true },
  parameters: { docs: { description: { story: 'Intentionally blank: an executed tool has no approval controls.' } } },
};
