import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProcessStepList } from './process-step-list';
import { ProcessStepListItem } from './process-step-list-item';
import type { ProcessStep } from './shared';

const meta: Meta<typeof ProcessStepList> = {
  title: 'Navigation/Steps',
  component: ProcessStepList,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ProcessStepList>;

const pendingSteps: ProcessStep[] = [
  { id: 'setup', status: 'pending', description: 'Initialize the project', title: 'Setup' },
  { id: 'configure', status: 'pending', description: 'Configure settings', title: 'Configure' },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy' },
];

const inProgressSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup' },
  { id: 'configure', status: 'running', description: 'Configure settings', title: 'Configure' },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy' },
];

const completedSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup' },
  { id: 'configure', status: 'success', description: 'Configure settings', title: 'Configure' },
  { id: 'deploy', status: 'success', description: 'Deploy to production', title: 'Deploy' },
];

const failedSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup' },
  { id: 'configure', status: 'failed', description: 'Configure settings', title: 'Configure' },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy' },
];

export const Default: Story = {
  args: {
    steps: pendingSteps,
    currentStep: null,
  },
};

export const InProgress: Story = {
  args: {
    steps: inProgressSteps,
    currentStep: inProgressSteps[1],
  },
};

export const PlainEmbedded: Story = {
  args: {
    steps: inProgressSteps,
    currentStep: inProgressSteps[1],
  },
  render: () => (
    <div className="flex w-full max-w-96 flex-col gap-1">
      {inProgressSteps.map((step, index) => (
        <ProcessStepListItem
          key={step.id}
          step={step}
          isActive={step.status === 'running'}
          position={index + 1}
          variant="plain"
        />
      ))}
    </div>
  ),
};

export const AllCompleted: Story = {
  args: {
    steps: completedSteps,
    currentStep: null,
  },
};

export const WithFailure: Story = {
  args: {
    steps: failedSteps,
    currentStep: null,
  },
};

export const ManySteps: Story = {
  args: {
    steps: [
      { id: 'init', status: 'success', description: 'Initialize', title: 'Init' },
      { id: 'validate', status: 'success', description: 'Validate inputs', title: 'Validate' },
      { id: 'process', status: 'running', description: 'Process data', title: 'Process' },
      { id: 'transform', status: 'pending', description: 'Transform results', title: 'Transform' },
      { id: 'output', status: 'pending', description: 'Generate output', title: 'Output' },
      { id: 'cleanup', status: 'pending', description: 'Clean up resources', title: 'Cleanup' },
    ],
    currentStep: {
      id: 'process',
      status: 'running',
      description: 'Process data',
      title: 'Process',
    },
  },
};

export const SingleStep: Story = {
  args: {
    steps: [{ id: 'single-task', status: 'running', description: 'Processing...', title: 'Task' }],
    currentStep: { id: 'single-task', status: 'running', description: 'Processing...', title: 'Task' },
  },
};
