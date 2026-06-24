// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as XyFlowReact from '@xyflow/react';
import type * as React from 'react';
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

// Captures the latest onNodesChange handler React Flow is wired with, so a test
// can deterministically simulate React Flow's post-mount layout pass (which in a
// real browser updates the node state and is what should re-trigger the focus
// effect). jsdom never lays out, so we drive that node-state settle explicitly.
const reactFlowControl = vi.hoisted(() => ({
  onNodesChange: undefined as ((changes: unknown[]) => void) | undefined,
}));

vi.mock('@xyflow/react', async importOriginal => {
  const actual = (await importOriginal()) as typeof XyFlowReact;

  return {
    ...actual,
    useReactFlow: () => reactFlowViewport,
    ReactFlow: ({ children, nodes, onNodesChange }: any) => {
      reactFlowControl.onNodesChange = onNodesChange;
      return (
        <div data-testid="react-flow-stub" data-node-count={nodes?.length ?? 0}>
          {children}
        </div>
      );
    },
  };
});

afterEach(() => {
  cleanup();
  reactFlowViewport.getNodes.mockReset();
  reactFlowViewport.setCenter.mockReset();
  reactFlowControl.onNodesChange = undefined;
});

function stepGraph(...stepIds: string[]): GetWorkflowResponse['stepGraph'] {
  return stepIds.map(stepId => ({
    type: 'step',
    step: { id: stepId, description: '' },
  })) as GetWorkflowResponse['stepGraph'];
}

const singleStepWorkflow = {
  name: 'Wf',
  stepGraph: stepGraph('step-a'),
} as unknown as GetWorkflowResponse;

const twoStepWorkflow = {
  name: 'Wf',
  stepGraph: stepGraph('step-a', 'step-b'),
} as unknown as GetWorkflowResponse;

function makeSnapshot(runId: string, ...stepIds: string[]): WorkflowRunState {
  return {
    runId,
    serializedStepGraph: stepGraph(...stepIds),
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
function Harness({
  contextValue,
  workflow,
  selectableStepId,
}: {
  contextValue: React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];
  workflow: GetWorkflowResponse;
  selectableStepId?: string;
}) {
  return (
    <WorkflowSelectedStepProvider>
      <WorkflowStepDetailProvider>
        <WorkflowRunContext.Provider value={contextValue}>
          <WorkflowGraph workflowId="wf" workflow={workflow} />
          {selectableStepId ? <SelectStepButton stepId={selectableStepId} /> : null}
        </WorkflowRunContext.Provider>
      </WorkflowStepDetailProvider>
    </WorkflowSelectedStepProvider>
  );
}

const twoNodes = [
  {
    id: 'step-a',
    data: { stepId: 'step-a', label: 'step-a' },
    measured: { width: 300, height: 120 },
    position: { x: 40, y: 80 },
  },
  {
    id: 'step-b',
    data: { stepId: 'step-b', label: 'step-b' },
    measured: { width: 300, height: 120 },
    position: { x: 440, y: 80 },
  },
];

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

    render(
      <Harness
        contextValue={{ snapshot: makeSnapshot('run-a', 'step-a') } as never}
        workflow={singleStepWorkflow}
        selectableStepId="step-a"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select step-a' }));

    await waitFor(() => {
      expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(190, 140, { duration: 300, zoom: 1 });
    });
    expect(document.activeElement).toBe(screen.getByTestId('workflow-graph-viewport'));
  });

  it('auto-focuses the step a paused run is waiting on, without any selection', async () => {
    reactFlowViewport.getNodes.mockReturnValue(twoNodes as never);

    // step-a already succeeded, so the paused run is waiting on step-b.
    render(
      <Harness
        contextValue={
          {
            workflow: twoStepWorkflow,
            result: { status: 'paused', steps: { 'step-a': { status: 'success' } } },
          } as never
        }
        workflow={twoStepWorkflow}
      />,
    );

    // Center of step-b: x 440 + 300/2 = 590, y 80 + 120/2 = 140.
    await waitFor(() => {
      expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(590, 140, { duration: 300, zoom: 1 });
    });
  });

  it('retries centering on the waiting step once nodes lay out after the first paint', async () => {
    // Reproduces the reported refocus race: when landing on a paused :runId page,
    // React Flow has not registered/measured its nodes on the first focus attempt.
    // getNodes() is empty then, so the initial run finds nothing. The focus effect
    // must retry once the node state settles (it depends on `nodes`), otherwise the
    // viewport never centers on the step the run is waiting on.
    let nodesLaidOut = false;
    reactFlowViewport.getNodes.mockImplementation(() => (nodesLaidOut ? (twoNodes as never) : ([] as never)));

    render(
      <Harness
        contextValue={
          {
            workflow: twoStepWorkflow,
            result: { status: 'paused', steps: { 'step-a': { status: 'success' } } },
          } as never
        }
        workflow={twoStepWorkflow}
      />,
    );

    // First paint: React Flow has not registered/measured its nodes, so getNodes()
    // is empty and the focus attempt finds nothing — nothing is centered.
    expect(reactFlowViewport.setCenter).not.toHaveBeenCalled();

    // React Flow's layout pass settles the node state. getNodes() now resolves the
    // waiting node, and the node-state change must re-trigger the focus effect.
    nodesLaidOut = true;
    act(() => {
      reactFlowControl.onNodesChange?.([{ id: 'step-a', type: 'position', position: { x: 1, y: 0 } }]);
    });

    // Center of step-b: x 440 + 300/2 = 590, y 80 + 120/2 = 140.
    await waitFor(() => {
      expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(590, 140, { duration: 300, zoom: 1 });
    });
  });

  it('lets an explicit selection override the waited step', async () => {
    reactFlowViewport.getNodes.mockReturnValue(twoNodes as never);

    render(
      <Harness
        contextValue={
          {
            workflow: twoStepWorkflow,
            result: { status: 'paused', steps: { 'step-a': { status: 'success' } } },
          } as never
        }
        workflow={twoStepWorkflow}
        selectableStepId="step-a"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select step-a' }));

    // Selection wins: center of step-a (190, 140), not step-b (590, 140).
    await waitFor(() => {
      expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(190, 140, { duration: 300, zoom: 1 });
    });
  });
});
