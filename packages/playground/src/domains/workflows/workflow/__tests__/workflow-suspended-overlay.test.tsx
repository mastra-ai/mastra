// @vitest-environment jsdom
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSuspendedOverlay } from '../workflow-suspended-overlay';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { pausedRunAfterFirstStepState, successfulRunState, suspendedRunState } from './fixtures/workflow-run-states';
import { falsySuspension, noWorkflowAuth, readOnlyWorkflowUser, suspendedChunk } from './fixtures/workflow-suspension';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function RunProbe() {
  const { result, runId, streamWorkflow, isStreamingWorkflow } = useContext(WorkflowRunContext);
  const { isLoading: isLoadingPermissions } = usePermissions();
  return (
    <>
      <output aria-label="Run state">{result?.status}</output>
      <output aria-label="Streaming state">{String(isStreamingWorkflow)}</output>
      <output aria-label="Permissions loaded">{String(!isLoadingPermissions)}</output>
      <button
        onClick={() => {
          if (runId) void streamWorkflow({ workflowId: 'two-step-workflow', runId, inputData: {}, requestContext: {} });
        }}
      >
        Stream current run
      </button>
    </>
  );
}

function renderOverlay(
  run: GetWorkflowRunByIdResponse = suspendedRunState,
  capabilities: AuthCapabilities = noWorkflowAuth,
) {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/${run.runId}`, () => HttpResponse.json(run)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={run.runId}>
          <RunProbe />
          <WorkflowSuspendedOverlay />
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('WorkflowSuspendedOverlay', () => {
  describe('when the selected run is suspended', () => {
    it('offers a response for the suspended step', async () => {
      renderOverlay();
      expect(await screen.findByRole('button', { name: 'Resume' })).not.toBeNull();
      expect(screen.getByText('transform')).not.toBeNull();
    });
  });

  describe('when a live suspension arrives before its saved snapshot', () => {
    it('offers the response using live state', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: pausedRunAfterFirstStepState.runId }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/stream`,
          () =>
            new HttpResponse(JSON.stringify({ ...suspendedChunk, runId: pausedRunAfterFirstStepState.runId }) + '\x1e'),
        ),
      );
      renderOverlay(pausedRunAfterFirstStepState);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('paused'));
      fireEvent.click(screen.getByRole('button', { name: 'Stream current run' }));
      expect(await screen.findByRole('button', { name: 'Resume' })).not.toBeNull();
    });
  });

  describe('when the selected run completed', () => {
    it('does not offer a response', async () => {
      renderOverlay(successfulRunState);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('success'));
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    });
  });

  describe('when the user can only read workflows', () => {
    it('does not offer execution through Resume', async () => {
      renderOverlay(suspendedRunState, readOnlyWorkflowUser);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('suspended'));
      await waitFor(() => expect(screen.getByLabelText('Permissions loaded').textContent).toBe('true'));
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    });
  });

  describe('when a suspension payload is false', () => {
    it('allows the user to inspect the actual request', async () => {
      renderOverlay(falsySuspension);
      await screen.findByRole('button', { name: 'Resume' });
      fireEvent.click(screen.getByRole('button', { name: /transform.*5 B/ }));
      expect(within(screen.getByTestId('suspended-payload')).getByText('false')).not.toBeNull();
    });
  });

  describe('when resume is connecting to the server', () => {
    it('prevents duplicate submissions until the active stream takes over', async () => {
      let releaseCreation = () => {};
      const creation = new Promise<void>(resolve => {
        releaseCreation = resolve;
      });
      let createRequests = 0;
      let finishStream = () => {};
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          finishStream = () => controller.close();
        },
      });
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, async () => {
          createRequests++;
          await creation;
          return HttpResponse.json({ runId: suspendedRunState.runId });
        }),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/resume-stream`, () => new HttpResponse(body)),
      );
      renderOverlay();
      fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
      await waitFor(() => expect(createRequests).toBe(1));
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /Resume/ }).disabled).toBe(true);
      releaseCreation();
      await waitFor(() => expect(screen.getByLabelText('Streaming state').textContent).toBe('true'));
      expect(screen.queryByTestId('workflow-suspended-overlay')).toBeNull();
      finishStream();
      await waitFor(() => expect(screen.getByLabelText('Streaming state').textContent).toBe('false'));
    });
  });
});
