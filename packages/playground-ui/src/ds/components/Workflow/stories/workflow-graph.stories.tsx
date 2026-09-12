import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkflowGraphPlaceholder } from '../graph/workflow-graph-placeholder';
import {
  sequentialNodes,
  sequentialEdges,
  branchNodes,
  branchEdges,
  parallelNodes,
  parallelEdges,
  loopNodes,
  loopEdges,
  nestedNodes,
  nestedEdges,
} from './graph/fixtures';
import { GraphExample } from './graph/graph-example';

const meta = {
  title: 'Workflows/Graph',
  component: GraphExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Studio uses this viewport and these card and edge renderers. These fixtures provide already-positioned nodes; workflow parsing, automatic layout, and live execution stay in Studio. Click a node to focus it, use the zoom controls, inspect edge data, or open the nested workflow.',
      },
    },
  },
  args: { nodes: sequentialNodes, edges: sequentialEdges },
  decorators: [
    Story => (
      <div className="w-full" style={{ height: 700 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GraphExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sequential: Story = {};
export const Branching: Story = { args: { nodes: branchNodes, edges: branchEdges } };
export const Parallel: Story = { args: { nodes: parallelNodes, edges: parallelEdges } };
export const Loop: Story = { args: { nodes: loopNodes, edges: loopEdges } };
export const Nested: Story = { args: { nodes: nestedNodes, edges: nestedEdges } };
export const Narrow: Story = {
  render: args => (
    <div className="h-full max-w-full" style={{ width: 360 }}>
      <GraphExample {...args} />
    </div>
  ),
};
export const Loading: Story = { render: () => <WorkflowGraphPlaceholder isLoading /> };
export const MissingWorkflow: Story = { render: () => <WorkflowGraphPlaceholder workflowName="Customer enrichment" /> };
