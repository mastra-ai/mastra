// @vitest-environment jsdom
import type { GetWorkflowResponse, GetWorkflowRunByIdResponse } from '@mastra/client-js';
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
import {
  falsySuspension,
  nestedIterationSuspension,
  nestedIterationWorkflow,
  noWorkflowAuth,
  readOnlyWorkflowUser,
  suspendedChunk,
  suspendedIterationArray,
} from './fixtures/workflow-suspension';
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
      <output aria-label="Suspended paths">{JSON.stringify(result?.suspended)}</output>
      <output aria-label="Iteration input">{JSON.stringify(result?.steps.transform?.payload)}</output>
      <output aria-label="Iteration output">{JSON.stringify(result?.steps.transform?.output)}</output>
      <output aria-label="Suspended output">{JSON.stringify(result?.steps.transform?.suspendOutput)}</output>
      <output aria-label="Iteration metadata">{JSON.stringify(result?.steps.transform?.metadata)}</output>
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
  workflow: GetWorkflowResponse = twoStepWorkflow,
) {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(workflow)),
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

  describe('when a later persisted iteration is suspended', () => {
    it('keeps its suspension request and all iteration data inspectable', async () => {
      renderOverlay(suspendedIterationArray);
      await screen.findByRole('button', { name: 'Resume' });
      expect(screen.getByLabelText('Iteration input').textContent).toBe('[false,{"document":"second"}]');
      expect(screen.getByLabelText('Iteration output').textContent).toBe('[0,null]');
      expect(screen.getByLabelText('Suspended output').textContent).toBe('false');
      expect(screen.getByLabelText('Iteration metadata').textContent).toBe('{"application":{"iteration":1}}');
      expect(screen.getByLabelText('Suspended paths').textContent).toBe('[["transform","review"]]');
      fireEvent.click(screen.getByRole('button', { name: /transform.*B/ }));
      const payload = screen.getByTestId('suspended-payload');
      expect(payload.textContent).toContain('opaque');
      expect(payload.textContent).toContain('untouched');
    });

    it('resumes the suspended nested step instead of the completed first iteration', async () => {
      let resumeRequest: unknown;
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: nestedIterationSuspension.runId }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/resume-stream`, async ({ request }) => {
          resumeRequest = await request.json();
          return new HttpResponse('');
        }),
      );
      renderOverlay(nestedIterationSuspension, noWorkflowAuth, nestedIterationWorkflow);
      fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
      await waitFor(() => expect(resumeRequest).toMatchObject({ step: ['nested', 'transform'] }));
    });
  });

  describe('when resume is connecting to the server', () => {
    it('prevents duplicate submissions until the active stream takes over', async () => {
      let releaseCreation = () => {};
      const creation = new Promise<void>(resolve => {
        releaseCreation = resolve;
      });
      let createRequests = 0;
      let resumeRequests = 0;
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
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/resume-stream`, () => {
          resumeRequests++;
          return new HttpResponse(body);
        }),
      );
      renderOverlay();
      fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
      await waitFor(() => expect(createRequests).toBe(1));
      const pendingResumeButton = within(screen.getByTestId('workflow-suspended-overlay')).getByRole<HTMLButtonElement>(
        'button',
        { name: (_, element) => element instanceof HTMLButtonElement && element.type === 'submit' },
      );
      expect(pendingResumeButton.disabled).toBe(true);
      fireEvent.click(pendingResumeButton);
      releaseCreation();
      await waitFor(() => expect(screen.getByLabelText('Streaming state').textContent).toBe('true'));
      await waitFor(() => expect(resumeRequests).toBe(1));
      expect(screen.queryByTestId('workflow-suspended-overlay')).toBeNull();
      finishStream();
      await waitFor(() => expect(screen.getByLabelText('Streaming state').textContent).toBe('false'));
      expect(resumeRequests).toBe(1);
    });
  });
});
