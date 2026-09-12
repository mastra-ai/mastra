import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WorkflowDebugControls } from '../controls/workflow-debug-controls';

const meta = {
  title: 'Workflows/Debug controls',
  component: WorkflowDebugControls,
  args: { canRunNextStep: true, onRunNextStep: fn(), onContinueRun: fn() },
  decorators: [
    Story => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkflowDebugControls>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Paused: Story = {};
export const Streaming: Story = { args: { isStreaming: true } };
export const NoNextStep: Story = { args: { canRunNextStep: false } };
