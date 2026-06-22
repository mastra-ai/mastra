// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as XyFlowReact from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWorkflowSelectedStep } from '../../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraph } from '../workflow-graph';

// The viewport refocus is the one place the graph reaches into the external
// React Flow library imperatively (getNodes/setCenter). We mock only that lib
// boundary so we can assert the imperative pan/zoom call without a real canvas.
const reactFlowViewport = vi.hoisted(() => ({
  getNodes: vi.fn(),
  setCenter: vi.fn(),
}));

vi.mock('@xyflow/react', async importOriginal => {
  const actual = (await importOriginal()) as typeof XyFlowReact;

  return {
    ...actual,
    useReactFlow: () => reactFlowViewport,
  };
});

afterEach(() => {
  cleanup();
  reactFlowViewport.getNodes.mockReset();
  reactFlowViewport.setCenter.mockReset();
});

function stepGraph(stepId: string): GetWorkflowResponse['stepGraph'] {
  return [{ type: 'step', step: { id: stepId, description: '' } }] as GetWorkflowResponse['stepGraph'];
}

const workflow = {
  name: 'Wf',
  stepGraph: stepGraph('step-a'),
} as unknown as GetWorkflowResponse;

function makeSnapshot(runId: string, stepId: string): WorkflowRunState {
  return {
    runId,
    serializedStepGraph: stepGraph(stepId),
  } as WorkflowRunState;
}

function SelectStepButton({ stepId }: { stepId: string }) {
  const { setSelectedStepId } = useWorkflowSelectedStep();

  return (
    <button type="button" onClick={() => setSelectedStepId(stepId)}>
      Select {stepId}
    </button>
  );
}

// Mirrors the page-level provider arrangement: WorkflowSelectedStepProvider and
// WorkflowRunContext live above WorkflowGraph, which owns ReactFlowProvider.
function Harness({ snapshot, selectableStepId }: { snapshot: WorkflowRunState; selectableStepId: string }) {
  return (
    <WorkflowSelectedStepProvider>
      <WorkflowStepDetailProvider>
        <WorkflowRunContext.Provider value={{ snapshot } as never}>
          <WorkflowGraph workflowId="wf" workflow={workflow} />
          <SelectStepButton stepId={selectableStepId} />
        </WorkflowRunContext.Provider>
      </WorkflowStepDetailProvider>
    </WorkflowSelectedStepProvider>
  );
}

describe('WorkflowGraph', () => {
  it('focuses and zooms the graph viewport when a workflow step is selected', async () => {
    reactFlowViewport.getNodes.mockReturnValue([
      {
        id: 'step-a',
        data: { label: 'step-a' },
        measured: { width: 300, height: 120 },
        position: { x: 40, y: 80 },
      },
    ] as never);

    render(<Harness snapshot={makeSnapshot('run-a', 'step-a')} selectableStepId="step-a" />);

    fireEvent.click(screen.getByRole('button', { name: 'Select step-a' }));

    await waitFor(() => {
      expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(190, 140, { duration: 300, zoom: 1 });
    });
    expect(document.activeElement).toBe(screen.getByTestId('workflow-graph-viewport'));
  });
});
