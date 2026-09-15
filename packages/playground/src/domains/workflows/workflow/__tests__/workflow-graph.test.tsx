// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowGraphCanvas } from '@mastra/playground-ui/components/Workflow';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as XyFlowReact from '@xyflow/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useContext, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWorkflowSelectedStep } from '../../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import type { WorkflowRunContextType } from '../../context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraph } from '../workflow-graph';
import { twoStepWorkflow as baseWorkflow } from './fixtures/workflow-debug-step-controls';

const reactFlowViewport = vi.hoisted(() => ({
  getNodes: vi.fn<() => XyFlowReact.Node[]>(() => []),
  fitView: vi.fn(),
  nodesInitialized: true,
  setCenter: vi.fn(),
}));

const reactFlowControl = vi.hoisted<{
  onNodesChange?: XyFlowReact.ReactFlowProps['onNodesChange'];
  resize?: (width: number, height: number) => void;
}>(() => ({}));

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    useReactFlow: () => reactFlowViewport,
    useNodesInitialized: () => reactFlowViewport.nodesInitialized,
    ReactFlow: ({ children, nodes, onNodesChange }: XyFlowReact.ReactFlowProps) => {
      const store = actual.useStoreApi();
      useLayoutEffect(() => {
        store.setState({ width: 1200, height: 800 });
      }, [store]);
      reactFlowControl.onNodesChange = onNodesChange;
      reactFlowControl.resize = (width, height) => store.setState({ width, height });
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
  reactFlowViewport.getNodes.mockReturnValue([]);
  reactFlowViewport.fitView.mockReset();
  reactFlowViewport.setCenter.mockReset();
  reactFlowControl.onNodesChange = undefined;
  reactFlowControl.resize = undefined;
  reactFlowViewport.nodesInitialized = true;
});

function stepGraph(...stepIds: string[]): GetWorkflowResponse['stepGraph'] {
  return stepIds.map(stepId => ({
    type: 'step',
    step: { id: stepId, description: '' },
  }));
}

const singleStepWorkflow: GetWorkflowResponse = {
  ...baseWorkflow,
  name: 'Wf',
  stepGraph: stepGraph('step-a'),
};

describe('WorkflowGraph fallback', () => {
  describe('when the workflow has no steps', () => {
    it('shows an explicit empty state', () => {
      render(<Harness workflow={{ ...singleStepWorkflow, stepGraph: [] }} />);
      expect(screen.getByRole('status').textContent).toBe('This workflow has no steps to display.');
    });
  });
  describe('when the server supplies an unsupported graph entry', () => {
    it('keeps the definition inspectable and recovers when the graph is replaced', async () => {
      const workflow: GetWorkflowResponse = {
        ...singleStepWorkflow,
        stepGraph: JSON.parse('[{"type":"future-step","id":"future-operation"}]'),
      };
      const view = render(<Harness workflow={workflow} />);
      expect(await screen.findByRole('alert')).not.toBeNull();
      expect(screen.getByText('Graph unavailable')).not.toBeNull();
      fireEvent.click(screen.getByText('View workflow definition'));
      expect(screen.getByText(/"future-operation"/)).not.toBeNull();
      view.rerender(<Harness workflow={singleStepWorkflow} />);
      expect(await screen.findByTestId('react-flow-stub')).not.toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});

const twoStepWorkflow: GetWorkflowResponse = {
  ...baseWorkflow,
  name: 'Wf',
  stepGraph: stepGraph('step-a', 'step-b'),
};

function SelectStepButton({ stepId }: { stepId: string }) {
  const { setSelectedStepId } = useWorkflowSelectedStep();

  return (
    <button type="button" onClick={() => setSelectedStepId(stepId)}>
      Select {stepId}
    </button>
  );
}

function Harness({
  contextValue,
  workflow,
  workflowId = 'wf',
  selectableStepId,
}: {
  contextValue?: Partial<WorkflowRunContextType>;
  workflow: GetWorkflowResponse;
  workflowId?: string;
  selectableStepId?: string;
}) {
  const defaultContext = useContext(WorkflowRunContext);

  return (
    <WorkflowSelectedStepProvider>
      <WorkflowStepDetailProvider>
        <WorkflowRunContext.Provider value={{ ...defaultContext, ...contextValue }}>
          <WorkflowGraph workflowId={workflowId} workflow={workflow} />
          {selectableStepId ? <SelectStepButton stepId={selectableStepId} /> : null}
        </WorkflowRunContext.Provider>
      </WorkflowStepDetailProvider>
    </WorkflowSelectedStepProvider>
  );
}

const twoNodes = [
  {
    id: 'node-step-a',
    data: { stepId: 'step-a', label: 'step-a' },
    measured: { width: 300, height: 120 },
    position: { x: 40, y: 80 },
  },
  {
    id: 'node-step-b',
    data: { stepId: 'step-b', label: 'step-b' },
    measured: { width: 300, height: 120 },
    position: { x: 440, y: 80 },
  },
];

describe('WorkflowGraph', () => {
  describe('when the workflow changes', () => {
    it('replaces the canvas nodes when switching workflows without a loading screen', async () => {
      const { rerender } = render(<Harness workflowId="first" workflow={singleStepWorkflow} />);

      await waitFor(() => expect(screen.getByTestId('react-flow-stub').getAttribute('data-node-count')).toBe('3'));

      rerender(<Harness workflowId="second" workflow={twoStepWorkflow} />);

      await waitFor(() => expect(screen.getByTestId('react-flow-stub').getAttribute('data-node-count')).toBe('4'));

      rerender(<Harness workflowId="first" workflow={singleStepWorkflow} />);

      await waitFor(() => expect(screen.getByTestId('react-flow-stub').getAttribute('data-node-count')).toBe('3'));
    });
  });

  describe('when a step is selected', () => {
    it('focuses and zooms the graph viewport when a workflow step is selected', async () => {
      reactFlowViewport.getNodes.mockReturnValue([
        {
          id: 'node-step-a',
          data: { label: 'step-a' },
          measured: { width: 300, height: 120 },
          position: { x: 40, y: 80 },
        },
      ]);

      render(<Harness workflow={singleStepWorkflow} selectableStepId="step-a" />);

      fireEvent.click(screen.getByRole('button', { name: 'Select step-a' }));

      await waitFor(() => {
        expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(190, 140, { duration: 300, zoom: 1 });
      });
      expect(document.activeElement).toBe(screen.getByTestId('workflow-graph-viewport'));
    });
  });

  describe('when a run updates without a step selection', () => {
    it.each(['paused', 'suspended', 'failed'] as const)('preserves the camera for a %s run', async status => {
      reactFlowViewport.getNodes.mockReturnValue(twoNodes);
      const view = render(<Harness workflow={twoStepWorkflow} />);
      const canvas = screen.getByTestId('react-flow-stub');
      reactFlowViewport.fitView.mockClear();
      view.rerender(
        <Harness
          workflow={twoStepWorkflow}
          contextValue={{
            workflow: twoStepWorkflow,
            result: {
              status,
              input: {},
              steps: {
                'step-a': { status: 'success', payload: {}, output: {}, startedAt: 1, endedAt: 2 },
                'step-b': { status: 'suspended', payload: {}, startedAt: 3, suspendPayload: {} },
              },
            },
          }}
        />,
      );
      expect(screen.getByTestId('react-flow-stub')).toBe(canvas);
      expect(reactFlowViewport.setCenter).not.toHaveBeenCalled();
      expect(reactFlowViewport.fitView).not.toHaveBeenCalled();
    });
  });

  describe('when selecting another run of the same workflow', () => {
    it('retains the mounted canvas', () => {
      const view = render(<Harness workflow={twoStepWorkflow} />);
      const canvas = screen.getByTestId('react-flow-stub');
      for (const runId of ['first-run', 'second-run']) {
        view.rerender(
          <Harness
            workflow={twoStepWorkflow}
            contextValue={{
              runSnapshot: {
                runId,
                context: {},
                status: 'success',
                serializedStepGraph: structuredClone(twoStepWorkflow.stepGraph),
              },
              snapshot: {
                runId,
                context: {},
                status: 'success',
                serializedStepGraph: structuredClone(twoStepWorkflow.stepGraph),
              },
            }}
          />,
        );
        expect(screen.getByTestId('react-flow-stub')).toBe(canvas);
      }
    });
  });

  describe('when node measurement finishes after the first paint', () => {
    it('retries centering on the waiting step once nodes lay out after the first paint', async () => {
      reactFlowViewport.nodesInitialized = false;
      let nodesLaidOut = false;
      reactFlowViewport.getNodes.mockImplementation(() => (nodesLaidOut ? twoNodes : []));

      render(
        <Harness
          contextValue={{
            workflow: twoStepWorkflow,
            result: {
              status: 'paused',
              input: {},
              steps: { 'step-a': { status: 'success', payload: {}, output: {}, startedAt: 1, endedAt: 2 } },
            },
          }}
          workflow={twoStepWorkflow}
          selectableStepId="step-b"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select step-b' }));
      expect(reactFlowViewport.setCenter).not.toHaveBeenCalled();

      nodesLaidOut = true;
      reactFlowViewport.nodesInitialized = true;
      act(() => {
        reactFlowControl.onNodesChange?.([{ id: 'node-step-a', type: 'position', position: { x: 1, y: 0 } }]);
      });

      await waitFor(() => {
        expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(590, 140, { duration: 300, zoom: 1 });
      });
    });
  });

  describe('when a step is selected during debug', () => {
    it('lets an explicit selection override the waited step', async () => {
      reactFlowViewport.getNodes.mockReturnValue(twoNodes);

      render(
        <Harness
          contextValue={{
            workflow: twoStepWorkflow,
            result: {
              status: 'paused',
              input: {},
              steps: { 'step-a': { status: 'success', payload: {}, output: {}, startedAt: 1, endedAt: 2 } },
            },
          }}
          workflow={twoStepWorkflow}
          selectableStepId="step-a"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select step-a' }));

      await waitFor(() => {
        expect(reactFlowViewport.setCenter).toHaveBeenCalledWith(190, 140, { duration: 300, zoom: 1 });
      });
    });
  });
  describe('when the user expands a node after positioning the canvas', () => {
    it('preserves the camera when the node measurements change', async () => {
      render(<Harness workflow={twoStepWorkflow} />);
      expect(screen.getByTestId('react-flow-stub')).not.toBeNull();
      fireEvent.pointerDown(screen.getByTestId('workflow-graph-viewport'));
      reactFlowViewport.fitView.mockClear();
      act(() => {
        reactFlowControl.onNodesChange?.([
          { id: 'node-step-a', type: 'dimensions', dimensions: { width: 688, height: 820 } },
        ]);
      });
      expect(reactFlowViewport.fitView).not.toHaveBeenCalled();
      expect(reactFlowViewport.setCenter).not.toHaveBeenCalled();
    });
  });

  describe('when the nested inspector acquires its final panel size', () => {
    it('fits the panel after resizing but preserves its camera when a node expands', () => {
      const tree = (nodes: XyFlowReact.Node[]) => (
        <ReactFlowProvider>
          <WorkflowGraphCanvas variant="nested" nodes={nodes} edges={[]} />
        </ReactFlowProvider>
      );
      const view = render(tree(twoNodes));
      expect(reactFlowViewport.fitView).toHaveBeenCalled();
      reactFlowViewport.fitView.mockClear();
      act(() => reactFlowControl.resize?.(420, 900));
      expect(reactFlowViewport.fitView).toHaveBeenCalled();
      reactFlowViewport.fitView.mockClear();
      view.rerender(tree(twoNodes.map(node => ({ ...node, measured: { width: 688, height: 820 } }))));
      expect(reactFlowViewport.fitView).not.toHaveBeenCalled();
    });
  });
});
