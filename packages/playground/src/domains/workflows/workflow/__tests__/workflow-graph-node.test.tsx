import type { GetWorkflowResponse } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraphNode } from '../workflow-graph-node';
import { resolveWorkflowGraphStep, WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import type { WorkflowStepNode, WorkflowStepNodeData } from '../workflow-step-node-utils';

afterEach(() => cleanup());

type RunContextValue = React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

const renderNode = (data: WorkflowStepNodeData, contextValue?: RunContextValue) => {
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
      <WorkflowRunContext.Provider value={(contextValue ?? {}) as RunContextValue}>
        <WorkflowSelectedStepProvider>
          <WorkflowStepDetailProvider>
            <WorkflowGraphNode {...props} stepsFlow={{}} />
          </WorkflowStepDetailProvider>
        </WorkflowSelectedStepProvider>
      </WorkflowRunContext.Provider>
    </ReactFlowProvider>,
  );
};

function stepGraph(...stepIds: string[]): GetWorkflowResponse['stepGraph'] {
  return stepIds.map(stepId => ({
    type: 'step',
    step: { id: stepId, description: '' },
  })) as GetWorkflowResponse['stepGraph'];
}

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

  it('marks the step a paused run is waiting on as the active step', () => {
    // step-a already succeeded, so the paused run is waiting on step-b. The waiting
    // step must be visibly marked so the user can always tell which step is active,
    // even when the viewport fails to recenter on it.
    renderNode(
      {
        label: 'step-b',
        stepId: 'step-b',
        workflowStep: resolveWorkflowGraphStep({ type: 'step', step: { id: 'step-b', description: '' } }),
      },
      {
        workflow: { name: 'Wf', stepGraph: stepGraph('step-a', 'step-b') },
        result: { status: 'paused', steps: { 'step-a': { status: 'success' } } },
      } as unknown as RunContextValue,
    );

    expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-waiting')).toBe('true');
  });

  it('does not mark a non-waiting step as the active step', () => {
    // The run is waiting on step-b, so step-a (already succeeded) must not be marked.
    renderNode(
      {
        label: 'step-a',
        stepId: 'step-a',
        workflowStep: resolveWorkflowGraphStep({ type: 'step', step: { id: 'step-a', description: '' } }),
      },
      {
        workflow: { name: 'Wf', stepGraph: stepGraph('step-a', 'step-b') },
        result: { status: 'paused', steps: { 'step-a': { status: 'success' } } },
      } as unknown as RunContextValue,
    );

    expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-waiting')).toBeNull();
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
