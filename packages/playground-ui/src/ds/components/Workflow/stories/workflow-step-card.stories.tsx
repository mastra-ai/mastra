import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkflowStepCardView } from '../cards/workflow-step-card-view';
import type { WorkflowCardDisplayStatus } from '../types';

const meta = {
  title: 'Workflows/Step card',
  component: WorkflowStepCardView,
  args: { label: 'Fetch customer', description: 'Load the customer profile from the CRM.' },
  argTypes: {
    displayStatus: {
      control: 'select',
      options: [undefined, 'running', 'success', 'failed', 'waiting', 'suspended', 'skipped', 'tripwire'],
    },
    actionBar: { control: false },
    date: { control: false },
  },
} satisfies Meta<typeof WorkflowStepCardView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StepTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <WorkflowStepCardView label="Regular step" description="Run a custom function." />
      <WorkflowStepCardView label="Agent step" description="Ask the support agent to draft a reply." />
      <WorkflowStepCardView label="Tool step" description="Look up an order." />
      <WorkflowStepCardView label="Mapping" mapConfig="return { customerId: input.id }" />
      <WorkflowStepCardView label="Parallel branch" isParallel />
      <WorkflowStepCardView label="For each customer" isForEach />
      <WorkflowStepCardView label="Sleep" duration={5000} />
      <WorkflowStepCardView label="Sleep until" date={new Date('2026-01-01T12:00:00Z')} />
      <WorkflowStepCardView label="Human approval" canSuspend />
      <WorkflowStepCardView label="Nested workflow" isNestedWorkflowStep stepGraph={[]} />
    </div>
  ),
};

const statuses: WorkflowCardDisplayStatus[] = [
  undefined,
  'running',
  'success',
  'failed',
  'waiting',
  'suspended',
  'skipped',
  'tripwire',
];

export const ExecutionStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {statuses.map(status => (
        <WorkflowStepCardView
          key={status ?? 'idle'}
          label={status ?? 'idle'}
          displayStatus={status}
          hasStep={status !== undefined}
        />
      ))}
    </div>
  ),
};

export const InteractionStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <WorkflowStepCardView label="Selected step" isSelected displayStatus="success" />
      <WorkflowStepCardView label="Waiting for debugger" isWaiting />
      <WorkflowStepCardView label="Hovered from timeline" isHovered />
    </div>
  ),
};

export const ForeachProgress: Story = {
  args: {
    label: 'Enrich customer profiles',
    isForEach: true,
    displayStatus: 'running',
    foreachProgress: { completedCount: 3, totalCount: 8, iterationStatus: 'success' },
  },
};

export const FailedIteration: Story = {
  args: {
    ...ForeachProgress.args,
    displayStatus: 'failed',
    foreachProgress: { completedCount: 3, totalCount: 8, iterationStatus: 'failed' },
  },
};

export const Completed: Story = { args: { displayStatus: 'success', startedAt: 1000, endedAt: 2245 } };
export const LongContent: Story = {
  args: {
    label: 'Fetch the complete customer history and all associated support conversations',
    description:
      'This step combines order history, support tickets, and account information before the agent prepares its response.',
  },
};
