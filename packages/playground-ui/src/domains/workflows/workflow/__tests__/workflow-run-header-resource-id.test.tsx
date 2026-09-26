// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowTrigger } from '../workflow-trigger';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { pausedRunAfterFirstStepState } from './fixtures/workflow-run-states';
import { server } from '@/test/msw-server';

const TRIGGER_PROPS = { requestContext: {}, onRequestContextChange: () => {}, canExecute: true };

const BASE_URL = 'http://localhost:4111';
const run = pausedRunAfterFirstStepState;

afterEach(cleanup);

function RunPanel() {
  const context = useContext(WorkflowRunContext);
  return <WorkflowTrigger {...context} {...TRIGGER_PROPS} paramsRunId={context.runId} />;
}

function renderStoredRun(stored: Record<string, unknown>) {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}`, () => HttpResponse.json(stored)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={run.runId}>
          <RunPanel />
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('stored workflow run header', () => {
  describe('when the stored run carries a resource', () => {
    it('shows it beside the run status', async () => {
      renderStoredRun({ ...run, resourceId: 'tenant-42' });

      expect(await screen.findByTitle('Resource tenant-42')).not.toBeNull();
    });
  });

  describe('when the stored run has no resource', () => {
    it('shows nothing in its place', async () => {
      renderStoredRun({ ...run, resourceId: null });

      await screen.findByText('Paused');
      expect(screen.queryByTitle(/^Resource /)).toBeNull();
    });
  });
});
