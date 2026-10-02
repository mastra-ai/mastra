// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowStepDetailContent } from '../../components/workflow-step-detail';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowGraphNode } from '../workflow-graph-node';
import { resolveWorkflowGraphStep, WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import type { WorkflowStepNode, WorkflowStepNodeData } from '../workflow-step-node-utils';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { graphRun } from './fixtures/workflow-graph-runtime';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function RunStatus() {
  const { result } = useContext(WorkflowRunContext);
  return <output aria-label="Loaded run status">{result?.status}</output>;
}

async function renderNode(data: WorkflowStepNodeData, parentWorkflowName?: string, siblingWorkflowName?: string) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/graph-run`, () => HttpResponse.json(graphRun)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: NodeProps<WorkflowStepNode> = {
    id: data.stepId ?? data.label,
    type: WORKFLOW_STEP_NODE_TYPE,
    data,
    selected: false,
    selectable: true,
    deletable: false,
    draggable: false,
    isConnectable: true,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <WorkflowStepDetailProvider>
          <WorkflowRunProvider workflowId="two-step-workflow" initialRunId="graph-run">
            <WorkflowSelectedStepProvider>
              <ReactFlowProvider>
                <RunStatus />
                <WorkflowGraphNode {...props} parentWorkflowName={parentWorkflowName} stepsFlow={{}} />
                {siblingWorkflowName && (
                  <WorkflowGraphNode
                    {...props}
                    id={`${props.id}-sibling`}
                    parentWorkflowName={siblingWorkflowName}
                    stepsFlow={{}}
                  />
                )}
                <WorkflowStepDetailContent requestContext={{}} />
              </ReactFlowProvider>
            </WorkflowSelectedStepProvider>
          </WorkflowRunProvider>
        </WorkflowStepDetailProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Loaded run status').textContent).toBe('running'));
}

describe('Workflow step detail panel', () => {
  describe('when a nested graph is opened from its step action', () => {
    it('inspects the nested workflow and toggles back to its parent canvas', async () => {
      const workflowStep = resolveWorkflowGraphStep({
        type: 'workflow',
        id: 'extract-customer',
        workflowId: 'customer-workflow',
        serializedStepFlow: [],
      });
      await renderNode({ label: 'extract-customer', stepId: 'extract-customer', stepGraph: [], workflowStep });
      fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
      fireEvent.click(await screen.findByText('View nested graph'));
      expect(await screen.findByText('extract-customer Workflow')).not.toBeNull();
      expect(screen.getByText('This workflow has no steps to display.')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
      fireEvent.click(await screen.findByText('Hide nested graph'));
      await waitFor(() => expect(screen.queryByText('extract-customer Workflow')).toBeNull());
    });
  });

  describe('when sibling scopes reuse the same nested workflow label', () => {
    it('opens the second scope instead of treating it as the already-open graph', async () => {
      const workflowStep = resolveWorkflowGraphStep({
        type: 'workflow',
        id: 'shared-child',
        workflowId: 'child',
        serializedStepFlow: [],
      });
      await renderNode(
        { label: 'shared-child', stepId: 'shared-child', stepGraph: [], workflowStep },
        'first',
        'second',
      );
      fireEvent.click(screen.getAllByRole('button', { name: 'Step actions' })[0]);
      fireEvent.click(await screen.findByText('View nested graph'));
      fireEvent.click(screen.getAllByRole('button', { name: 'Step actions' })[1]);
      fireEvent.click(await screen.findByText('View nested graph'));
      expect(screen.getByText('shared-child Workflow')).not.toBeNull();
    });
  });

  describe('when a mapping configuration is inspected', () => {
    it('shows the actual mapping source and closes without a dialog', async () => {
      const mapConfig = 'return input.customerId';
      await renderNode({
        label: 'Map customer',
        stepId: 'mapping_customer',
        mapConfig,
        workflowStep: resolveWorkflowGraphStep({ type: 'mapping', id: 'mapping_customer', mapConfig }),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
      fireEvent.click(await screen.findByText('Map config'));
      expect(await screen.findByText('Map customer Config')).not.toBeNull();
      expect(screen.getByTestId('workflow-step-detail-panel').textContent).toContain(mapConfig);
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('workflow-step-detail-panel')).toBeNull();
    });
  });

  describe('when a condition belongs to a nested workflow scope', () => {
    it('uses that scope rather than a same-named root predecessor', async () => {
      await renderNode(
        {
          label: 'condition',
          nodeRole: 'condition',
          previousStepId: 'extract',
          nextStepId: 'transform',
          conditions: [{ type: 'when', fnString: 'input.customerId' }],
          workflowStep: resolveWorkflowGraphStep({
            type: 'conditional',
            steps: [],
            serializedConditions: [{ id: 'condition', fn: 'input.customerId' }],
          }),
        },
        'nested',
      );
      expect(screen.getByTestId('workflow-condition-node').getAttribute('data-workflow-step-status')).toBe('idle');
    });
  });
});
