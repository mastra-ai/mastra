import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ToolCall, ToolCallCommand, ToolCallContent, ToolCallPresentedHeader, ToolCallTrigger } from './tool-call';
import { ToolCallArguments } from './tool-call-arguments';
import { ToolCallGroup } from './tool-call-group';
import type { ToolCallGroupStep } from './tool-call-group';
import { ToolCallOutput } from './tool-call-output';
import { presentTool } from './tool-presentation';

interface ToolPreviewProps extends ToolCallGroupStep {
  argsText?: string;
  hideArguments?: boolean;
  commandOnly?: boolean;
  output?: string;
  maxOutputLength?: number;
  defaultOpen?: boolean;
}

function ToolPreview({
  toolName,
  args,
  argsText,
  hideArguments,
  commandOnly,
  status,
  output,
  maxOutputLength,
  defaultOpen,
}: ToolPreviewProps) {
  const presentation = presentTool(toolName, args);
  return (
    <ToolCall status={status} defaultOpen={defaultOpen} aria-label={`Tool: ${toolName}`}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader {...presentation} />
      </ToolCallTrigger>
      <ToolCallContent>
        {commandOnly && presentation.command ? (
          <ToolCallCommand command={presentation.command} />
        ) : (
          <ToolCallArguments toolName={toolName} args={args} argsText={argsText} hideArguments={hideArguments} />
        )}
        {output !== undefined && (
          <section aria-label="Tool output">
            <ToolCallOutput text={output} error={status === 'error'} maxLength={maxOutputLength} />
          </section>
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
  argTypes: {
    argsText: { description: 'Partial streamed arguments, used before structured args are available.' },
    hideArguments: { description: 'Hides ordinary arguments while keeping edit previews.', control: 'boolean' },
    commandOnly: { description: 'Shows the command line instead of all JSON arguments, as Factory does.' },
    maxOutputLength: { description: 'Limits the visible preview. Copy always includes the complete output.' },
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shared argument/edit and output blocks used by Studio and Factory. Apps normalize their tool data and choose which output to show; these components own presentation and copying. Factory bounds result previews while copying the full value. Studio keeps complete arguments and results, including successful edit results. Approval actions are also shared; requests and lifecycle stay with each app.',
      },
    },
  },
} satisfies Meta<typeof ToolPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArgumentsAndResult: Story = { args: { output: 'export const count = 1;' } };

const editArguments = { path: 'src/agent.ts', old_string: 'const count = 1;', new_string: 'const count = 2;' };

export const SuccessfulEditWithResult: Story = {
  args: { toolName: 'edit_file', args: editArguments, output: 'Updated src/agent.ts successfully.' },
  parameters: { docs: { description: { story: 'Studio retains the full success result alongside the file change.' } } },
};

export const EditPreviewOnly: Story = {
  args: { toolName: 'edit_file', args: editArguments },
  parameters: { docs: { description: { story: 'Factory shows the file change without a redundant success result.' } } },
};

export const FailedEdit: Story = {
  args: {
    toolName: 'edit_file',
    args: editArguments,
    status: 'error',
    output: 'Permission denied: src/agent.ts',
  },
};

export const RunningCommand: Story = {
  args: {
    toolName: 'execute_command',
    args: { command: 'pnpm test' },
    commandOnly: true,
    status: 'running',
    output: 'Running tests…',
  },
  parameters: { docs: { description: { story: 'Factory combines the command line with live shell output.' } } },
};

export const CommandWithAllArguments: Story = {
  args: {
    toolName: 'execute_command',
    args: { command: 'pnpm test', cwd: '/workspace', timeout: 30000 },
    output: 'Tests passed',
  },
  parameters: { docs: { description: { story: 'Studio keeps every argument available for inspection and copying.' } } },
};

export const PartialArguments: Story = {
  args: { args: undefined, argsText: '{"path":"src/agent', status: 'running' },
};

export const ResultOnly: Story = {
  args: { hideArguments: true, output: 'Agent source loaded.' },
};

export const EmptyArguments: Story = {
  args: { args: undefined },
  parameters: { docs: { description: { story: 'No argument block renders before any input is available.' } } },
};

export const LongOutput: Story = {
  args: {
    output: 'A long tool result with the full content available through copy.\n'.repeat(50),
    maxOutputLength: 800,
  },
  play: async ({ canvasElement, args }) => {
    const user = userEvent.setup();
    const output = within(canvasElement).getByRole('region', { name: 'Tool output' });
    await user.click(within(output).getByRole('button', { name: 'Copy to clipboard' }));
    await expect(await navigator.clipboard.readText()).toBe(args.output);
  },
};

export const FullOutput: Story = {
  args: { ...LongOutput.args, maxOutputLength: undefined },
  play: LongOutput.play,
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
