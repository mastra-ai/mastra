// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import type { StreamVNextChunkType } from '@mastra/client-js';
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
import { pausedRunAfterFirstStepState, suspendedRunState } from './fixtures/workflow-run-states';
import { server } from '@/test/msw-server';

const TRIGGER_PROPS = { requestContext: {}, onRequestContextChange: () => {}, canExecute: true };

const BASE_URL = 'http://localhost:4111';
const run = pausedRunAfterFirstStepState;
afterEach(cleanup);

function RunPanel({ onSelectRun, observed }: { onSelectRun: () => void; observed: boolean }) {
  const context = useContext(WorkflowRunContext);
  return (
    <>
      <button onClick={onSelectRun}>View another run</button>
      <WorkflowTrigger
        {...TRIGGER_PROPS}
        {...context}
        paramsRunId={context.runId}
        observeWorkflowStream={observed ? context.observeWorkflowStream : undefined}
      />
    </>
  );
}

function RunSelection({ observed, initialRunId }: { observed: boolean; initialRunId: string }) {
  const [runId, selectRun] = useState(initialRunId);
  return (
    <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={runId}>
      <RunPanel onSelectRun={() => selectRun('another-run')} observed={observed} />
    </WorkflowRunProvider>
  );
}

const pausedReplay: StreamVNextChunkType[] = [
  { type: 'workflow-start', runId: run.runId, from: 'WORKFLOW', payload: { workflowId: 'two-step-workflow' } },
  {
    type: 'workflow-finish',
    runId: run.runId,
    from: 'WORKFLOW',
    payload: {
      workflowStatus: 'paused',
      output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
      metadata: {},
    },
  },
];

function renderRun({ run = pausedRunAfterFirstStepState, observed = false } = {}) {
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
        <RunSelection observed={observed} initialRunId={run.runId} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('WorkflowTrigger cancellation', () => {
  describe('when the server confirms cancellation of a suspended run', () => {
    it('replaces the suspended status with canceled', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/runs/${suspendedRunState.runId}/cancel`, () =>
          HttpResponse.json({ message: 'Workflow run cancelled' }),
        ),
      );
      renderRun({ run: suspendedRunState });
      await screen.findByText('Suspended');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel workflow run' }));
      await screen.findByText('Canceled');
      expect(screen.queryByRole('button', { name: 'Cancel workflow run' })).toBeNull();
    });
  });
  describe('when the server confirms cancellation of a paused run', () => {
    it('replaces the paused controls with the canceled status', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}/cancel`, () =>
          HttpResponse.json({ message: 'Workflow run cancelled' }),
        ),
      );
      renderRun();
      const cancel = await screen.findByRole('button', { name: 'Cancel workflow run' });
      fireEvent.click(cancel);
      await screen.findByText('Canceled');
      expect(screen.queryByRole('button', { name: 'Run next step' })).toBeNull();
    });
  });
  describe('when the paused run is also observed live', () => {
    it('replaces the paused controls with the canceled status', async () => {
      let observed = false;
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/observe`, () => {
          observed = true;
          return new HttpResponse(pausedReplay.map(chunk => JSON.stringify(chunk) + '\x1e').join(''));
        }),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}/cancel`, () =>
          HttpResponse.json({ message: 'Workflow run cancelled' }),
        ),
      );
      renderRun({ observed: true });
      await waitFor(() => expect(observed).toBe(true));
      await waitFor(() =>
        expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Run next step' }).disabled).toBe(false),
      );
      fireEvent.click(screen.getByRole('button', { name: /Cancel workflow run/i }));
      await screen.findByText('Canceled');
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
      renderRun();
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel workflow run' }));
      await screen.findByRole('button', { name: 'Cancelling run…' });
      fireEvent.click(screen.getByRole('button', { name: 'View another run' }));
      finishCancellation();
      await waitFor(() =>
        expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel workflow run' }).disabled).toBe(false),
      );
      expect(screen.getByText('another-run')).not.toBeNull();
      expect(screen.getByText('Paused')).not.toBeNull();
      expect(screen.queryByText('Canceled')).toBeNull();
    });
  });
});
