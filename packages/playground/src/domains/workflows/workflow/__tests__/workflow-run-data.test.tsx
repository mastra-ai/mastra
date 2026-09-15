import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowTrigger } from '../workflow-trigger';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { failedDataRun, successfulDataRun } from './fixtures/workflow-run-data';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function RunPanel() {
  const context = useContext(WorkflowRunContext);
  return <WorkflowTrigger {...context} paramsRunId={context.runId} observeWorkflowStream={undefined} />;
}

function renderRun(run: typeof failedDataRun) {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}`, () => HttpResponse.json(run)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={run.runId}>
          <RunPanel />
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('Workflow run data', () => {
  describe('when a saved run failed', () => {
    it('keeps the failure visible while the data section is collapsed', async () => {
      renderRun(failedDataRun);
      expect(await screen.findByText(/Dispatch failed/)).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Run data' }).getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Run input' })).toBeNull();
    });

    it('groups the submitted input and full execution without inventing an output', async () => {
      renderRun(failedDataRun);
      fireEvent.click(await screen.findByRole('button', { name: 'Run data' }));
      expect(screen.getByRole('tab', { name: 'Input' })).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Output' })).toBeNull();
      expect(within(screen.getByRole('tabpanel', { name: 'Input' })).getByText(/Test customer/)).not.toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Execution' }));
      expect(screen.getByRole('tabpanel', { name: 'Execution' }).textContent).toContain('"status": "failed"');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when a saved run produced a falsy output', () => {
    it('keeps the actual output available in a read-only view', async () => {
      renderRun(successfulDataRun);
      fireEvent.click(await screen.findByRole('button', { name: 'Run data' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Output' }));
      const panel = screen.getByRole('tabpanel', { name: 'Output' });
      expect(within(panel).getByText('false')).not.toBeNull();
      expect(panel.querySelector('[contenteditable="true"]')).toBeNull();
    });
  });
});
