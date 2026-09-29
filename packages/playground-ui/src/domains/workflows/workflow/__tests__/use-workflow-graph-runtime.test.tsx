// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { useWorkflowGraphRuntime } from '../use-workflow-graph-runtime';
import type { WorkflowGraphEdge } from '../utils';
import { constructNodesAndEdges } from '../utils';
import { branchWorkflow, twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { completedIterationRun, graphRun } from './fixtures/workflow-graph-runtime';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

async function renderRuntime(run: GetWorkflowRunByIdResponse, edges: WorkflowGraphEdge[], workflowName?: string) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/graph-run`, () => HttpResponse.json(run)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkflowRunProvider workflowId="two-step-workflow" initialRunId="graph-run">
          {children}
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const { result } = renderHook(
    () => ({
      ...useWorkflowGraphRuntime({ edges, workflowName }),
      runResult: useContext(WorkflowRunContext).result,
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.runResult).not.toBeNull());
  return result;
}

describe('Workflow graph runtime', () => {
  describe('when data passes between steps', () => {
    it('marks the completed connection solid without completing a running predecessor', async () => {
      const edges: WorkflowGraphEdge[] = [
        {
          id: 'completed',
          source: 'extract',
          target: 'transform',
          animated: true,
          data: { previousStepId: 'extract', nextStepId: 'transform' },
        },
        {
          id: 'pending',
          source: 'transform',
          target: 'load',
          data: { previousStepId: 'transform', nextStepId: 'load' },
        },
      ];
      const result = await renderRuntime(graphRun, edges);
      expect(result.current.styledEdges[0]).toMatchObject({ animated: false, data: { edgeStatus: 'success' } });
      expect(result.current.styledEdges[1].data?.edgeStatus).toBe('idle');
    });
  });

  describe('when a branch decision skips an arm', () => {
    it('keeps only the taken arm connected', async () => {
      const { edges } = constructNodesAndEdges(branchWorkflow);
      const result = await renderRuntime(
        {
          ...graphRun,
          status: 'paused',
          steps: {
            'short-text': { status: 'skipped', startedAt: 100 },
            'long-text': { status: 'success', payload: {}, output: 'matched', startedAt: 100, endedAt: 200 },
          },
        },
        edges,
      );
      const shortEdges = result.current.styledEdges.filter(edge => edge.data?.nextStepId === 'short-text');
      const longEdges = result.current.styledEdges.filter(edge => edge.data?.nextStepId === 'long-text');
      expect(shortEdges.map(edge => edge.data?.edgeStatus)).toEqual(['idle', 'idle']);
      expect(longEdges.map(edge => edge.data?.edgeStatus)).toEqual(['success', 'success']);
    });
  });

  describe('when multiple branch conditions match', () => {
    it('keeps both matching arms connected', async () => {
      const { edges } = constructNodesAndEdges(branchWorkflow);
      const result = await renderRuntime(
        {
          ...graphRun,
          status: 'paused',
          steps: {
            'short-text': { status: 'success', payload: {}, output: 'short', startedAt: 100, endedAt: 200 },
            'long-text': { status: 'success', payload: {}, output: 'long', startedAt: 100, endedAt: 200 },
          },
        },
        edges,
      );
      const branchEdges = result.current.styledEdges.filter(edge => edge.data?.conditionNode);
      expect(branchEdges.map(edge => edge.data?.edgeStatus)).toEqual(['success', 'success', 'success', 'success']);
    });
  });

  describe('when a workflow has not completed', () => {
    it('distinguishes delivered input from an unavailable final result', async () => {
      const { edges } = constructNodesAndEdges(twoStepWorkflow);
      const result = await renderRuntime(graphRun, edges);
      expect(
        result.current.styledEdges.find(edge => edge.data?.boundaryPayload === 'workflow-input')?.data?.edgeStatus,
      ).toBe('success');
      expect(
        result.current.styledEdges.find(edge => edge.data?.boundaryPayload === 'workflow-output')?.data?.edgeStatus,
      ).toBe('idle');
    });

    it.each(['pending', 'skipped'] as const)('keeps a %s first step disconnected from input', async status => {
      const { edges } = constructNodesAndEdges(twoStepWorkflow);
      const result = await renderRuntime(
        { ...graphRun, steps: status === 'pending' ? {} : { extract: { status: 'skipped', startedAt: 100 } } },
        edges,
      );
      expect(
        result.current.styledEdges.find(edge => edge.data?.boundaryPayload === 'workflow-input')?.data?.edgeStatus,
      ).toBe('idle');
    });
  });

  describe('when the workflow succeeds', () => {
    it('connects the final result to End', async () => {
      const { edges } = constructNodesAndEdges(twoStepWorkflow);
      const result = await renderRuntime({ ...graphRun, status: 'success', result: { completed: true } }, edges);
      expect(
        result.current.styledEdges.find(edge => edge.data?.boundaryPayload === 'workflow-output')?.data?.edgeStatus,
      ).toBe('success');
    });
  });

  describe('when a completed foreach item has a falsy result', () => {
    it.each(['batch[0]', 'batch[1]'])(
      'connects the selected %s result rather than requiring a synthetic parent step',
      async scope => {
        const { edges } = constructNodesAndEdges(twoStepWorkflow);
        const result = await renderRuntime(completedIterationRun, edges, scope);
        expect(
          result.current.styledEdges.find(edge => edge.data?.boundaryPayload === 'workflow-output')?.data?.edgeStatus,
        ).toBe('success');
      },
    );
  });
});
