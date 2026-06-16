// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraphNode } from '../workflow-graph-node';
import { resolveWorkflowGraphStep, WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import type { WorkflowStepNode, WorkflowStepNodeData } from '../workflow-step-node-utils';

afterEach(() => cleanup());

const renderNode = (data: WorkflowStepNodeData) => {
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
      <WorkflowStepDetailProvider>
        <WorkflowGraphNode {...props} stepsFlow={{}} />
      </WorkflowStepDetailProvider>
    </ReactFlowProvider>,
  );
};

describe('WorkflowGraphNode', () => {
  it('renders map steps through the unified default node surface', async () => {
    renderNode({
      label: 'map-step',
      stepId: 'map-step',
      workflowStep: resolveWorkflowGraphStep({
        type: 'step',
        step: { id: 'map-step', description: 'Map the previous output', mapConfig: 'return input' },
      }),
      description: 'Map the previous output',
      mapConfig: 'return input',
    });

    expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-status')).toBe('idle');
    expect(screen.getByText('map-step')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Map step' })).not.toBeNull();
    expect(screen.queryByText('MAP')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    expect(await screen.findByText('Map config')).not.toBeNull();
  });

  it('renders conditions through the unified condition node surface', () => {
    renderNode({
      label: 'condition-1',
      workflowStep: resolveWorkflowGraphStep({
        type: 'conditional',
        steps: [],
        serializedConditions: [{ id: 'condition-1', fn: 'input.value > 0' }],
      }),
      nodeRole: 'condition',
      previousStepId: 'previous',
      nextStepId: 'next',
      conditions: [{ type: 'when', fnString: 'input.value > 0' }],
    });

    const conditionNode = screen.getByTestId('workflow-condition-node');
    expect(conditionNode).not.toBeNull();
    expect(screen.getByRole('img', { name: 'When condition' })).not.toBeNull();
    expect(screen.queryByText('WHEN')).toBeNull();
    expect(conditionNode.textContent).toContain('input.value > 0');
  });
});
