// @vitest-environment jsdom
import type { GetWorkflowResponse, GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as XyFlowReact from '@xyflow/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { baseWorkflow } from '../../components/__tests__/fixtures/workflow';
import { useWorkflowSelectedStep } from '../../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowGraph } from '../workflow-graph';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { server } from '@/test/msw-server';

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

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'wf';

function stubWorkflow(response: GetWorkflowResponse = workflow) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(response)));
}

function stubRunById(runId: string, response: GetWorkflowRunByIdResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${runId}`, () => HttpResponse.json(response)));
}

afterEach(() => {
  cleanup();
  reactFlowViewport.getNodes.mockReset();
  reactFlowViewport.setCenter.mockReset();
});

function SelectStepButton({ stepId }: { stepId: string }) {
  const { setSelectedStepId } = useWorkflowSelectedStep();

  return (
    <button type="button" onClick={() => setSelectedStepId(stepId)}>
      Select {stepId}
    </button>
  );
}

function stepGraph(stepId: string): GetWorkflowResponse['stepGraph'] {
  return [{ type: 'step', step: { id: stepId, description: '' } }] as GetWorkflowResponse['stepGraph'];
}

function makeSnapshot(runId: string, stepId: string): WorkflowRunState {
  return {
    runId,
    serializedStepGraph: stepGraph(stepId),
  } as WorkflowRunState;
}

const workflow: GetWorkflowResponse = {
  ...baseWorkflow,
  name: 'Wf',
  steps: {
    'static-step': {
      id: 'static-step',
      description: '',
      inputSchema: baseWorkflow.inputSchema,
      outputSchema: baseWorkflow.outputSchema,
      resumeSchema: baseWorkflow.steps['step-1'].resumeSchema,
      suspendSchema: baseWorkflow.steps['step-1'].suspendSchema,
      stateSchema: baseWorkflow.stateSchema,
    },
  },
  allSteps: {
    'static-step': {
      id: 'static-step',
      description: '',
      inputSchema: baseWorkflow.inputSchema,
      outputSchema: baseWorkflow.outputSchema,
      resumeSchema: baseWorkflow.allSteps['step-1'].resumeSchema,
      suspendSchema: baseWorkflow.allSteps['step-1'].suspendSchema,
      stateSchema: baseWorkflow.stateSchema,
      isWorkflow: false,
    },
  },
  stepGraph: stepGraph('static-step'),
};

function Harness({ snapshot, selectableStepId }: { snapshot: WorkflowRunState; selectableStepId?: string }) {
  // The graph keys its React Flow node/edge state on the route-driven snapshot.runId,
  // mirroring how WorkflowLayout builds the snapshot from useParams().runId.
  return (
    <WorkflowSelectedStepProvider>
      <WorkflowRunContext.Provider value={{ snapshot } as never}>
        <WorkflowGraph workflowId="wf" workflow={workflow} />
        {selectableStepId && <SelectStepButton stepId={selectableStepId} />}
      </WorkflowRunContext.Provider>
    </WorkflowSelectedStepProvider>
  );
}

const runWithSuccessfulStep: GetWorkflowRunByIdResponse = {
  runId: 'run-with-status',
  workflowName: 'wf',
  status: 'success',
  createdAt: new Date(2026, 4, 29, 16, 19, 44),
  updatedAt: new Date(2026, 4, 29, 16, 19, 44),
  serializedStepGraph: stepGraph('static-step'),
  steps: {
    'static-step': {
      status: 'success',
    },
  },
};

function providerGraphUi(queryClient: QueryClient, initialRunId?: string) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
          <WorkflowSelectedStepProvider>
            <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
              <WorkflowGraph workflowId={WORKFLOW_ID} workflow={workflow} />
            </WorkflowRunProvider>
          </WorkflowSelectedStepProvider>
        </TracingSettingsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function renderProviderGraph(initialRunId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const rendered = render(providerGraphUi(queryClient, initialRunId));

  return {
    ...rendered,
    rerenderRoute(nextRunId?: string) {
      rendered.rerender(providerGraphUi(queryClient, nextRunId));
    },
  };
}

describe('WorkflowGraph', () => {
  it('reflects the selected run by rendering the snapshot step graph, not the static workflow', () => {
    const { rerender } = render(<Harness snapshot={makeSnapshot('run-a', 'step-a')} />);

    expect(screen.getByText('step-a')).not.toBeNull();
    expect(screen.queryByText('static-step')).toBeNull();

    // Selecting a different run changes the snapshot's serialized graph. The graph must
    // remount so React Flow seeds fresh nodes instead of keeping the previous run's graph.
    rerender(<Harness snapshot={makeSnapshot('run-b', 'step-b')} />);

    expect(screen.getByText('step-b')).not.toBeNull();
    expect(screen.queryByText('step-a')).toBeNull();
  });

  it('remounts the graph when switching runs of the same workflow (shared step graph)', () => {
    // Two runs of the same workflow share an identical serializedStepGraph, so only the
    // snapshot.runId differs. Keying on snapshot.runId (not the graph) is what forces React
    // Flow to reseed per run — the exact case the previous graph-based key missed.
    const { rerender } = render(<Harness snapshot={makeSnapshot('run-a', 'shared-step')} />);

    const first = screen.getByText('shared-step');

    rerender(<Harness snapshot={makeSnapshot('run-b', 'shared-step')} />);

    const second = screen.getByText('shared-step');
    // A remount produces a new DOM node for the same label; same node would mean stale state.
    expect(second).not.toBe(first);
  });

  it('marks graph nodes as hovered from pointer interactions', async () => {
    render(<Harness snapshot={makeSnapshot('run-a', 'step-a')} />);

    const node = screen.getByTestId('workflow-default-node');
    expect(node.getAttribute('data-workflow-step-key')).toBe('step-a');
    expect(node.getAttribute('data-workflow-step-hovered')).toBeNull();

    fireEvent.mouseEnter(node);
    await waitFor(() => {
      expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-hovered')).toBe('true');
    });

    fireEvent.mouseLeave(screen.getByTestId('workflow-default-node'));
    await waitFor(() => {
      expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-hovered')).toBeNull();
    });
  });

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

  it('clears run-derived node status when returning from a run route to the base workflow route', async () => {
    stubRunById('run-with-status', runWithSuccessfulStep);
    stubWorkflow();

    const { rerenderRoute } = renderProviderGraph('run-with-status');

    await screen.findByTestId('workflow-default-node');
    await waitFor(() => {
      expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-status')).toBe('success');
    });

    rerenderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('workflow-default-node').getAttribute('data-workflow-step-status')).toBe('idle');
    });
  });
});
