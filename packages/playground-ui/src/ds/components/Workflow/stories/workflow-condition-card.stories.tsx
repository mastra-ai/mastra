import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkflowConditionCard } from '../cards/workflow-condition-card';

const meta = {
  title: 'Workflows/Condition card',
  component: WorkflowConditionCard,
  args: { conditions: [{ type: 'when', fnString: 'input.orderTotal > 100' }] },
} satisfies Meta<typeof WorkflowConditionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Collapsed: Story = { args: { initiallyOpen: false } };
export const BranchesAndLoops: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <WorkflowConditionCard conditions={[{ type: 'if', fnString: 'input.isPremium' }]} />
      <WorkflowConditionCard conditions={[{ type: 'else', fnString: '' }]} />
      <WorkflowConditionCard conditions={[{ type: 'when', fnString: 'input.approved' }]} />
      <WorkflowConditionCard conditions={[{ type: 'dountil', fnString: 'output.ready === true' }]} />
      <WorkflowConditionCard conditions={[{ type: 'dowhile', fnString: 'output.hasNextPage' }]} />
      <WorkflowConditionCard conditions={[{ type: 'until', fnString: 'output.count >= 3' }]} />
      <WorkflowConditionCard conditions={[{ type: 'while', fnString: 'output.hasMore' }]} />
    </div>
  ),
};
export const MultipleConditions: Story = {
  args: {
    conditions: [
      { type: 'if', ref: { step: { id: 'fetch-order' }, path: 'total' }, query: { $gt: 100 } },
      { type: 'if', conj: 'and', ref: { step: 'trigger', path: 'approved' }, query: { $eq: true } },
    ],
  },
};
export const LongFunction: Story = {
  args: {
    conditions: [
      {
        type: 'when',
        fnString:
          '({ inputData }) => {\n  const hasCompleteProfile = inputData.customer.email && inputData.customer.address;\n  return hasCompleteProfile && inputData.order.total > 100;\n}',
      },
    ],
  },
};
