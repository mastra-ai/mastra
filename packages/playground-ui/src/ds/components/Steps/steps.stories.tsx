import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProcessStepList } from './process-step-list';
import type { ProcessStep } from './shared';

const meta: Meta<typeof ProcessStepList> = {
  title: 'Navigation/Steps',
  component: ProcessStepList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProcessStepList>;

const pendingSteps: ProcessStep[] = [
  { id: 'setup', status: 'pending', description: 'Initialize the project', title: 'Setup', isActive: false },
  { id: 'configure', status: 'pending', description: 'Configure settings', title: 'Configure', isActive: false },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy', isActive: false },
];

const inProgressSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup', isActive: false },
  { id: 'configure', status: 'running', description: 'Configure settings', title: 'Configure', isActive: true },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy', isActive: false },
];

const completedSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup', isActive: false },
  { id: 'configure', status: 'success', description: 'Configure settings', title: 'Configure', isActive: false },
  { id: 'deploy', status: 'success', description: 'Deploy to production', title: 'Deploy', isActive: false },
];

const failedSteps: ProcessStep[] = [
  { id: 'setup', status: 'success', description: 'Initialize the project', title: 'Setup', isActive: false },
  { id: 'configure', status: 'failed', description: 'Configure settings', title: 'Configure', isActive: false },
  { id: 'deploy', status: 'pending', description: 'Deploy to production', title: 'Deploy', isActive: false },
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
      { id: 'init', status: 'success', description: 'Initialize', title: 'Init', isActive: false },
      { id: 'validate', status: 'success', description: 'Validate inputs', title: 'Validate', isActive: false },
      { id: 'process', status: 'running', description: 'Process data', title: 'Process', isActive: true },
      { id: 'transform', status: 'pending', description: 'Transform results', title: 'Transform', isActive: false },
      { id: 'output', status: 'pending', description: 'Generate output', title: 'Output', isActive: false },
      { id: 'cleanup', status: 'pending', description: 'Clean up resources', title: 'Cleanup', isActive: false },
    ],
    currentStep: {
      id: 'process',
      status: 'running',
      description: 'Process data',
      title: 'Process',
      isActive: true,
    },
  },
};

export const SingleStep: Story = {
  args: {
    steps: [{ id: 'single-task', status: 'running', description: 'Processing...', title: 'Task', isActive: true }],
    currentStep: { id: 'single-task', status: 'running', description: 'Processing...', title: 'Task', isActive: true },
  },
};
