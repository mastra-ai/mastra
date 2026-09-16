// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowTrigger } from '../workflow-trigger';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { pausedRunAfterFirstStepState } from './fixtures/workflow-run-states';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const run = pausedRunAfterFirstStepState;
afterEach(cleanup);

function RunPanel({ onSelectRun }: { onSelectRun: () => void }) {
  const context = useContext(WorkflowRunContext);
  return (
    <>
      <button onClick={onSelectRun}>View another run</button>
      <WorkflowTrigger {...context} paramsRunId={context.runId} observeWorkflowStream={undefined} />
    </>
  );
}

function RunSelection() {
  const [runId, selectRun] = useState(run.runId);
  return (
    <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={runId}>
      <RunPanel onSelectRun={() => selectRun('another-run')} />
    </WorkflowRunProvider>
  );
}

function renderPausedRun() {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}`, () => HttpResponse.json(run)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/another-run`, () =>
      HttpResponse.json({ ...run, runId: 'another-run' }),
    ),
    http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () => HttpResponse.json({ runId: run.runId })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <RunSelection />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('WorkflowTrigger cancellation', () => {
  describe('when the server confirms cancellation of a paused run', () => {
    it('replaces the paused controls with the canceled status', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}/cancel`, () =>
          HttpResponse.json({ message: 'Workflow run cancelled' }),
        ),
      );
      renderPausedRun();
      const cancel = await screen.findByRole('button', { name: /Cancel workflow run/i });
      fireEvent.click(cancel);
      await screen.findByText('Canceled');
      expect(screen.queryByRole('button', { name: 'Run next step' })).toBeNull();
    });
  });
  describe('when another run is selected during cancellation', () => {
    it('does not apply the previous cancellation to the selected run', async () => {
      let finishCancellation = () => {};
      const cancellation = new Promise<void>(resolve => {
        finishCancellation = resolve;
      });
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}/cancel`, async () => {
          await cancellation;
          return HttpResponse.json({ message: 'Workflow run cancelled' });
        }),
      );
      renderPausedRun();
      fireEvent.click(await screen.findByRole('button', { name: /Cancel workflow run/i }));
      await waitFor(() =>
        expect(screen.getByRole<HTMLButtonElement>('button', { name: /Cancel workflow run/i }).disabled).toBe(true),
      );
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Run next step' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue full run' }).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'View another run' }));
      finishCancellation();
      await waitFor(() =>
        expect(screen.getByRole<HTMLButtonElement>('button', { name: /Cancel workflow run/i }).disabled).toBe(false),
      );
      expect(screen.getByText('another-run')).not.toBeNull();
      expect(screen.getByText('Paused')).not.toBeNull();
      expect(screen.queryByText('Canceled')).toBeNull();
    });
  });
});
