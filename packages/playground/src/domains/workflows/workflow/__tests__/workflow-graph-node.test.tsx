import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraphNode } from '../workflow-graph-node';
import { resolveWorkflowGraphStep, WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import type { WorkflowStepNode, WorkflowStepNodeData } from '../workflow-step-node-utils';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { pausedRunAfterFirstStepState } from './fixtures/workflow-run-states';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function renderNode(data: WorkflowStepNodeData, runId?: string) {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/${pausedRunAfterFirstStepState.runId}`, () =>
      HttpResponse.json(pausedRunAfterFirstStepState),
    ),
  );
  const props: NodeProps<WorkflowStepNode> = {
    id: data.label,
    type: WORKFLOW_STEP_NODE_TYPE,
    data,
    selected: false,
    selectable: false,
    deletable: false,
    draggable: false,
    isConnectable: false,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={runId}>
            <ReactFlowProvider>
              <WorkflowSelectedStepProvider>
                <WorkflowStepDetailProvider>
                  <WorkflowGraphNode {...props} stepsFlow={{}} />
                </WorkflowStepDetailProvider>
              </WorkflowSelectedStepProvider>
            </ReactFlowProvider>
          </WorkflowRunProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('WorkflowGraphNode', () => {
  describe('when a workflow contains a map step', () => {
    it('shows its badge and configuration action', async () => {
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
      expect(screen.getByText('Map')).not.toBeNull();
      expect(screen.getByText('Not started')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
      expect(await screen.findByText('Map config')).not.toBeNull();
    });
  });

  describe('when a saved run is paused after its first step', () => {
    it('identifies the next step on its card', async () => {
      renderNode(
        {
          label: 'transform',
          stepId: 'transform',
          workflowStep: resolveWorkflowGraphStep({ type: 'step', step: { id: 'transform', description: '' } }),
        },
        pausedRunAfterFirstStepState.runId,
      );
      expect(await screen.findByText('Next step in debug')).not.toBeNull();
    });

    it('keeps the completed step separate from the next step', async () => {
      renderNode(
        {
          label: 'extract',
          stepId: 'extract',
          workflowStep: resolveWorkflowGraphStep({ type: 'step', step: { id: 'extract', description: '' } }),
        },
        pausedRunAfterFirstStepState.runId,
      );
      await waitFor(() => expect(screen.getByText('Completed')).not.toBeNull());
      expect(screen.queryByText('Next step in debug')).toBeNull();
    });
  });

  describe('when a workflow contains a predicate', () => {
    it('shows the source inline with a labeled condition badge', () => {
      renderNode({
        label: 'conditional',
        workflowStep: resolveWorkflowGraphStep({ type: 'conditional', steps: [], serializedConditions: [] }),
        conditions: [{ type: 'when', fnString: 'input.value > 0' }],
      });
      expect(screen.getByText('When')).not.toBeNull();
      expect(screen.getByRole('region', { name: 'Condition details' }).textContent).toContain('input.value > 0');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
