import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { WorkflowStepCardView } from '../cards/step/workflow-step-card-view';
import type { WorkflowCardDisplayStatus } from '../types';

const meta = {
  title: 'Workflows/Step card',
  component: WorkflowStepCardView,
  args: { label: 'Fetch customer', description: 'Load the customer profile from the CRM.' },
  argTypes: {
    displayStatus: {
      control: 'select',
      options: [undefined, 'running', 'success', 'failed', 'waiting', 'paused', 'suspended', 'skipped', 'tripwire'],
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
      <WorkflowStepCardView label="Agent step" nodeKind="agent" description="Ask the support agent to draft a reply." />
      <WorkflowStepCardView label="Tool step" nodeKind="tool" description="Look up an order." />
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
  'paused',
  'suspended',
  'skipped',
  'tripwire',
];

export const ExecutionStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {statuses.map(status => (
        <WorkflowStepCardView key={status ?? 'idle'} label={status ?? 'idle'} displayStatus={status} />
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

export const InspectAndExpand: Story = {
  render: args => {
    const [selected, setSelected] = useState(false);
    return (
      <WorkflowStepCardView
        {...args}
        label="Approval workflow"
        isNestedWorkflowStep
        isSelected={selected}
        onSelect={() => setSelected(current => !current)}
        body={<WorkflowStepCardView label="Review order" displayStatus="suspended" canSuspend />}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inspect = canvas.getByRole('button', { name: 'Inspect Approval workflow' });
    inspect.focus();
    await userEvent.keyboard('{Enter}');
    await expect(inspect).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.queryByText('Review order')).not.toBeInTheDocument();
    canvas.getByRole('button', { name: 'Expand workflow' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText('Review order')).toBeVisible();
    await expect(inspect).toHaveAttribute('aria-pressed', 'true');
  },
};

export const EmptyLoop: Story = {
  args: {
    label: 'Process empty batch',
    isForEach: true,
    displayStatus: 'success',
    foreachProgress: { completedCount: 0, totalCount: 0, iterationStatus: 'success' },
  },
};

export const UnavailableTiming: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <WorkflowStepCardView label="Paused without completion time" displayStatus="paused" startedAt={1000} />
      <WorkflowStepCardView label="Invalid schedule" date={new Date('invalid')} />
      <WorkflowStepCardView label="Invalid delay" duration={-1} />
      <WorkflowStepCardView label="Immediate delay" duration={0} />
    </div>
  ),
};

export const ExpandedLoop: Story = {
  args: {
    label: 'Enrich each customer',
    isForEach: true,
    initiallyOpen: true,
    displayStatus: 'running',
    foreachProgress: { completedCount: 2, totalCount: 5, iterationStatus: 'success' },
    body: (
      <div className="flex flex-wrap gap-6 p-6">
        <WorkflowStepCardView label="Fetch profile" displayStatus="success" startedAt={1000} endedAt={1120} />
        <WorkflowStepCardView label="Validate profile" displayStatus="running" />
      </div>
    ),
  },
};

export const RunningClock: Story = {
  render: args => {
    const [startedAt] = useState(() => Date.now());
    return <WorkflowStepCardView {...args} displayStatus="running" startedAt={startedAt} />;
  },
};
