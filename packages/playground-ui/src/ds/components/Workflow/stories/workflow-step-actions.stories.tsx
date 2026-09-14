import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WorkflowStepCardView } from '../cards/workflow-step-card-view';
import { WorkflowStepAction } from '../controls/workflow-step-action';
import { WorkflowStepActions } from '../controls/workflow-step-actions';

const selectAction = fn();
const meta = {
  title: 'Workflows/Step actions',
  component: WorkflowStepActions,
  decorators: [Story => <WorkflowStepCardView label="Review customer" actionBar={<Story />} />],
} satisfies Meta<typeof WorkflowStepActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inspect: Story = {
  args: {
    children: (
      <>
        <WorkflowStepAction action="nested" onSelect={selectAction} />
        <WorkflowStepAction action="map" onSelect={selectAction} />
        <WorkflowStepAction action="resumeData" onSelect={selectAction} />
        <WorkflowStepAction action="error" onSelect={selectAction} />
        <WorkflowStepAction action="tripwire" onSelect={selectAction} />
      </>
    ),
  },
};
export const Debug: Story = {
  args: {
    children: (
      <>
        <WorkflowStepAction action="runStep" onSelect={selectAction} />
        <WorkflowStepAction action="continueRun" onSelect={selectAction} />
      </>
    ),
  },
};
export const TimeTravel: Story = {
  args: { children: <WorkflowStepAction action="timeTravel" onSelect={selectAction} /> },
};
export const OpenPanels: Story = {
  args: {
    children: (
      <>
        <WorkflowStepAction action="nested" isActive onSelect={selectAction} />
        <WorkflowStepAction action="map" isActive onSelect={selectAction} />
      </>
    ),
  },
};
