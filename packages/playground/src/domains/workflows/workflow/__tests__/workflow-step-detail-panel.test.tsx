import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowStepDetailPanel } from '../../components/workflow-step-detail';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraphNode } from '../workflow-graph-node';
import { resolveWorkflowGraphStep, WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import type { WorkflowStepNode, WorkflowStepNodeData } from '../workflow-step-node-utils';

afterEach(() => cleanup());

const nestedStepGraph: SerializedStepFlowEntry[] = [{ type: 'step', step: { id: 'inner-step', description: '' } }];

// Covers the panel mechanism itself: the action bar (rendered inside the graph nodes)
// and the WorkflowStepDetailPanel sharing one WorkflowStepDetailProvider, plus the
// View/Hide toggle. It mirrors how `workflow-graph.tsx` composes the two, but mounts
// them explicitly. It does NOT reproduce #18346 ("panel never mounted in the graph"):
// that wiring lives inside ReactFlow nodes, which only render once measured, and jsdom
// has no layout — so the original bug is only reachable via a real browser (Playwright).
const renderNodeWithPanel = (data: WorkflowStepNodeData) => {
  const props = {
    id: data.label,
    type: WORKFLOW_STEP_NODE_TYPE,
    data,
    selected: false,
    isConnectable: true,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as NodeProps<WorkflowStepNode>;

  return render(
    <ReactFlowProvider>
      <WorkflowSelectedStepProvider>
        <WorkflowStepDetailProvider>
          <WorkflowGraphNode {...props} stepsFlow={{}} />
          <WorkflowStepDetailPanel />
        </WorkflowStepDetailProvider>
      </WorkflowSelectedStepProvider>
    </ReactFlowProvider>,
  );
};

describe('WorkflowStepDetailPanel', () => {
  it('opens the nested graph panel from the step action menu and toggles it closed', async () => {
    renderNodeWithPanel({
      label: 'extract-customer',
      stepId: 'extract-customer',
      description: 'Extracts customer data',
      stepGraph: nestedStepGraph,
      workflowStep: resolveWorkflowGraphStep({
        type: 'step',
        step: {
          id: 'extract-customer',
          description: '',
          component: 'WORKFLOW',
          serializedStepFlow: nestedStepGraph,
        },
      } as SerializedStepFlowEntry),
    });

    // Panel is hidden until the action is triggered.
    expect(screen.queryByText('extract-customer Workflow')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    fireEvent.click(await screen.findByText('View nested graph'));

    // The detail panel now renders the nested workflow.
    expect(await screen.findByText('extract-customer Workflow')).not.toBeNull();

    // The action label flips to "Hide nested graph" and toggles the panel back off.
    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    fireEvent.click(await screen.findByText('Hide nested graph'));

    await waitFor(() => expect(screen.queryByText('extract-customer Workflow')).toBeNull());
  });

  it('opens the map config panel from the step action menu', async () => {
    renderNodeWithPanel({
      label: 'map-step',
      stepId: 'map-step',
      description: 'Map the previous output',
      mapConfig: 'return input',
      workflowStep: resolveWorkflowGraphStep({
        type: 'step',
        step: { id: 'map-step', description: 'Map the previous output', mapConfig: 'return input' },
      }),
    });

    expect(screen.queryByText('map-step Config')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    fireEvent.click(await screen.findByText('Map config'));

    expect(await screen.findByText('map-step Config')).not.toBeNull();
  });
});
