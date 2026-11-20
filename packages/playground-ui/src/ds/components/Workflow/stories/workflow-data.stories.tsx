import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { WorkflowCodeContent } from '../data/workflow-code-dialog-content';
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

export const ExternalInspector: Story = {
  render: args => {
    const [inspecting, setInspecting] = useState(false);
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <WorkflowEdgeDataButton {...args} selected={inspecting} onInspect={() => setInspecting(true)} />
        {inspecting && (
          <section aria-label="Selected edge payload">
            <WorkflowCodeContent data={args.output} />
          </section>
        )}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View fetch-customer output' }));
    await expect(canvas.getByRole('region', { name: 'Selected edge payload' })).toHaveTextContent('customer-42');
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
