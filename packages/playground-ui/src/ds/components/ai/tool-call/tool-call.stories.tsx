import type { Meta, StoryObj } from '@storybook/react-vite';

import { AgentIcon } from '../../../icons/AgentIcon';
import { ToolCoinIcon } from '../../../icons/ToolCoinIcon';
import { WorkflowIcon } from '../../../icons/WorkflowIcon';
import { Button } from '../../Button';
import { TooltipProvider } from '../../Tooltip';
import { Tool, ToolCall, ToolCallListItem, ToolContent, ToolHeader, ToolIcon } from './tool-call';

const meta: Meta<typeof ToolCall> = {
  title: 'AI/Tool Call',
  component: ToolCall,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="bg-surface1 min-h-screen w-full p-4">
          <div className="max-w-2xl">
            <Story />
          </div>
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ToolCall>;

export const RunningCommand: Story = {
  args: {
    toolName: 'execute_command',
    input: { command: "cd '/repo' && pnpm test" },
    status: 'running',
  },
};

export const SuccessfulCommand: Story = {
  args: {
    toolName: 'execute_command',
    input: { command: "cd '/repo' && pnpm test" },
    result: 'Tests: 42 passed',
    status: 'success',
  },
};

export const FailedTool: Story = {
  args: {
    toolName: 'write_file',
    input: { path: 'src/config.ts', content: 'export const enabled = true;' },
    result: 'Permission denied',
    status: 'error',
  },
};

export const StringReplace: Story = {
  args: {
    toolName: 'string_replace',
    input: {
      path: 'src/config.ts',
      old_string: 'export const enabled = false;',
      new_string: 'export const enabled = true;',
    },
    status: 'success',
  },
};

export const FileWrite: Story = {
  args: {
    toolName: 'write_file',
    input: { path: 'src/answer.ts', content: 'export const answer = 42;' },
    result: 'Wrote src/answer.ts',
    status: 'success',
  },
};

export const GenericTool: Story = {
  args: {
    toolName: 'fetch_pull_request',
    input: { owner: 'mastra-ai', repository: 'mastra', number: 42 },
    result: { title: 'Share the Factory tool UI', state: 'open' },
    status: 'success',
    defaultOpen: true,
  },
};

export const GenericTextTool: Story = {
  args: {
    toolName: 'weatherInfo',
    input: 'city=Paris',
    result: 'Sunny, 18°C',
    status: 'success',
    defaultOpen: true,
  },
};

export const PendingAction: Story = {
  args: {
    toolName: 'charge_card',
    input: { amount: 42, currency: 'EUR' },
    status: 'running',
    defaultOpen: true,
    headerActions: (
      <Button type="button" variant="ghost" size="xs">
        Details
      </Button>
    ),
    children: (
      <Button type="button" variant="primary" size="sm">
        Approve
      </Button>
    ),
  },
};

export const CustomEntities: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Tool status="success" defaultOpen aria-label="Order fulfillment workflow">
        <ToolHeader>
          <ToolIcon tooltip="Workflow">
            <WorkflowIcon className="text-accent3" />
          </ToolIcon>
          Order fulfillment
        </ToolHeader>
        <ToolContent>
          <div className="text-icon3">Workflow graph and run controls</div>
        </ToolContent>
      </Tool>

      <Tool status="success" defaultOpen aria-label="Research agent">
        <ToolHeader>
          <ToolIcon tooltip="Sub-agent">
            <AgentIcon className="text-accent1" />
          </ToolIcon>
          Research agent
        </ToolHeader>
        <ToolContent>
          <div className="text-icon3">Sub-agent response and nested tool calls</div>
        </ToolContent>
      </Tool>

      <Tool status="success" defaultOpen aria-label="Code mode">
        <ToolHeader>
          <ToolIcon tooltip="Code mode">
            <ToolCoinIcon className="text-accent6" />
          </ToolIcon>
          execute_typescript
        </ToolHeader>
        <ToolContent>
          <div className="text-icon3 font-mono">return await getOrders();</div>
        </ToolContent>
      </Tool>
    </div>
  ),
};

export const ConnectedSequence: Story = {
  render: () => (
    <div className="flex flex-col">
      <ToolCallListItem continued>
        <ToolCall toolName="write_file" input={{ path: 'src/answer.ts' }} status="success" />
      </ToolCallListItem>
      <ToolCallListItem>
        <ToolCall toolName="execute_command" input={{ command: 'pnpm test' }} status="success" />
      </ToolCallListItem>
    </div>
  ),
};
