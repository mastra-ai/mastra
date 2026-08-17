import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../Button';
import { TooltipProvider } from '../../Tooltip';
import { ToolCall } from './tool-call';

const meta: Meta<typeof ToolCall> = {
  title: 'AI/Tool Call',
  component: ToolCall,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-full max-w-2xl p-4">
          <Story />
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

export const UnknownTool: Story = {
  args: {
    toolName: 'fetch_pull_request',
    input: { owner: 'mastra-ai', repository: 'mastra', number: 42 },
    result: { title: 'Share the Factory tool UI', state: 'open' },
    status: 'success',
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
