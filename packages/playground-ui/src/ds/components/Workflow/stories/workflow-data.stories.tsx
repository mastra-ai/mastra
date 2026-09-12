import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkflowEdgeDataButton } from '../data/workflow-edge-data-button';

const meta = {
  title: 'Workflows/Edge data',
  component: WorkflowEdgeDataButton,
  args: {
    previousStepId: 'fetch-customer',
    output: { id: 'customer-42', name: 'Ada', orders: [{ id: 'order-1', total: 125 }] },
  },
} satisfies Meta<typeof WorkflowEdgeDataButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StepOutput: Story = {};
export const WorkflowInput: Story = { args: { label: 'Workflow input', output: { customerId: 'customer-42' } } };
export const WorkflowOutput: Story = { args: { label: 'Workflow output', output: { approved: true } } };
export const NoOutput: Story = { args: { output: undefined } };
export const NullOutput: Story = { args: { output: null } };
export const FalseOutput: Story = { args: { output: false } };
export const ZeroOutput: Story = { args: { output: 0 } };
export const EmptyString: Story = { args: { output: '' } };
