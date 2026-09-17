import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ToolCall, ToolCallCommand, ToolCallContent, ToolCallPresentedHeader, ToolCallTrigger } from './tool-call';
import { ToolCallArguments } from './tool-call-arguments';
import { ToolCallGroup } from './tool-call-group';
import type { ToolCallGroupStep } from './tool-call-group';
import { ToolCallOutput } from './tool-call-output';
import { presentTool } from './tool-presentation';

interface ToolPreviewProps extends ToolCallGroupStep {
  output?: string;
  maxOutputLength?: number;
  defaultOpen?: boolean;
}

function ToolPreview({ toolName, args, status, output, maxOutputLength, defaultOpen }: ToolPreviewProps) {
  const presentation = presentTool(toolName, args);
  return (
    <ToolCall status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader {...presentation} />
      </ToolCallTrigger>
      <ToolCallContent>
        {presentation.command ? (
          <ToolCallCommand command={presentation.command} />
        ) : (
          <ToolCallArguments toolName={toolName} args={args} />
        )}
        {output !== undefined && (
          <ToolCallOutput text={output} error={status === 'error'} maxLength={maxOutputLength} />
        )}
      </ToolCallContent>
    </ToolCall>
  );
}

const meta = {
  title: 'AI/Tool Call Presentation',
  component: ToolPreview,
  decorators: [
    Story => (
      <div className="w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
  args: { toolName: 'view', args: { path: 'src/agent.ts' }, status: 'idle', defaultOpen: true },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shared argument/edit and output blocks used by Studio and Factory. Apps normalize their tool data and choose which output to show; these components own presentation and copying. Factory bounds result previews while copying the full value. Studio keeps complete arguments and results, including successful edit results. Approval controls and transport stay with each app.',
      },
    },
  },
} satisfies Meta<typeof ToolPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArgumentsAndResult: Story = { args: { output: 'export const count = 1;' } };

export const FailedEdit: Story = {
  args: {
    toolName: 'edit_file',
    args: { path: 'src/agent.ts', old_string: 'const count = 1;', new_string: 'const count = 2;' },
    status: 'error',
    output: 'Permission denied: src/agent.ts',
  },
};

export const RunningCommand: Story = {
  args: { toolName: 'execute_command', args: { command: 'pnpm test' }, status: 'running', output: 'Running tests…' },
};

export const LongOutput: Story = {
  args: {
    output: 'A long tool result with the full content available through copy.\n'.repeat(50),
    maxOutputLength: 800,
  },
};

const readStep: ToolPreviewProps = {
  toolName: 'view',
  args: { path: 'src/agent.ts' },
  status: 'idle',
  hasResult: true,
  output: 'Agent source',
};
const searchStep: ToolPreviewProps = {
  toolName: 'search_content',
  args: { pattern: 'TODO' },
  status: 'idle',
  hasResult: true,
  output: 'No matches',
};
const commandStep: ToolPreviewProps = {
  toolName: 'execute_command',
  args: { command: 'pnpm test' },
  status: 'idle',
  hasResult: true,
  output: 'Tests passed',
};
const completedSteps = [readStep, searchStep, commandStep];

function ToolGroupPreview({ steps }: { steps: ToolPreviewProps[] }) {
  return (
    <ToolCallGroup steps={steps}>
      {steps.map(step => (
        <ToolPreview key={step.toolName} {...step} />
      ))}
    </ToolCallGroup>
  );
}

export const CompletedGroup: Story = { render: () => <ToolGroupPreview steps={completedSteps} /> };

export const MixedOutcomes: Story = {
  render: () => (
    <ToolGroupPreview
      steps={[
        readStep,
        { ...searchStep, status: 'error', hasResult: false, output: 'Search failed: permission denied' },
        { ...commandStep, hasResult: false, output: undefined },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Tool group: 3 steps' });
    await expect(within(group).getByText('1 OK · 1 failed · 1 incomplete')).toBeVisible();
    await userEvent.click(within(group).getByRole('button'));
    const failed = canvas.getByRole('group', { name: 'Tool: search_content' });
    await userEvent.click(within(failed).getByRole('button'));
    await expect(within(failed).getByText('Search failed: permission denied')).toBeVisible();
  },
};

export const RunningGroup: Story = {
  render: () => (
    <ToolGroupPreview
      steps={[readStep, searchStep, { ...commandStep, status: 'running', hasResult: false, output: 'Running tests…' }]}
    />
  ),
};
