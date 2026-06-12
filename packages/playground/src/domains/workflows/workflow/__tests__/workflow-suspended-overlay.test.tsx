// @vitest-environment jsdom
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useContext, useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { baseWorkflow } from '../../components/__tests__/fixtures/workflow';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { runWithSuspendedStep, runWithTimedSteps } from '../../runs/__tests__/fixtures/workflow-runs';
import { convertWorkflowRunStateToStreamResult } from '../../utils';
import { WorkflowSuspendedOverlay } from '../workflow-suspended-overlay';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'demo-workflow';

function stubWorkflow() {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(baseWorkflow)));
}

function stubRunById(runId: string, response: GetWorkflowRunByIdResponse, onRequest?: () => void) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${runId}`, () => {
      onRequest?.();
      return HttpResponse.json(response);
    }),
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function Providers({
  initialRunId,
  children,
  queryClient,
}: {
  initialRunId?: string;
  children: ReactNode;
  queryClient: QueryClient;
}) {
  // Mirror the real route shape: a stored run is viewed at /workflows/:workflowId/:runId,
  // while a brand-new run has no runId segment. The overlay reads the route runId via useParams.
  const initialEntry = initialRunId ? `/workflows/${WORKFLOW_ID}/${initialRunId}` : `/workflows/${WORKFLOW_ID}`;
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
          <SchemaRequestContextProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <Routes>
                <Route
                  path="/workflows/:workflowId/:runId"
                  element={
                    <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
                      {children}
                    </WorkflowRunProvider>
                  }
                />
                <Route
                  path="/workflows/:workflowId"
                  element={
                    <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
                      {children}
                    </WorkflowRunProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </SchemaRequestContextProvider>
        </TracingSettingsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function renderOverlay(initialRunId?: string) {
  return render(
    <Providers initialRunId={initialRunId} queryClient={createQueryClient()}>
      <WorkflowSuspendedOverlay />
    </Providers>,
  );
}

afterEach(cleanup);

describe('WorkflowSuspendedOverlay', () => {
  it('renders nothing when there is no suspended step', async () => {
    const onRunRequest = vi.fn();
    stubRunById('run-timeline-1', runWithTimedSteps, onRunRequest);
    stubWorkflow();

    const queryClient = createQueryClient();
    const { container } = render(
      <Providers initialRunId="run-timeline-1" queryClient={queryClient}>
        <WorkflowSuspendedOverlay />
      </Providers>,
    );

    await waitFor(() => expect(onRunRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(container.querySelector('[data-testid="workflow-suspended-overlay"]')).toBeNull();
  });

  it('renders the suspended overlay when a step is suspended', async () => {
    stubRunById('run-suspended-1', runWithSuspendedStep);
    stubWorkflow();

    renderOverlay('run-suspended-1');

    expect(await screen.findByTestId('workflow-suspended-overlay')).not.toBeNull();
    expect(screen.getByText('Step suspended')).not.toBeNull();
    expect(screen.getByText('Needs input')).not.toBeNull();
    expect(screen.getByText('First step')).not.toBeNull();
    expect(screen.getByText('The step is asking')).not.toBeNull();
    expect(await screen.findByText('Your response')).not.toBeNull();
    expect(screen.getByRole('button', { name: /resume/i })).not.toBeNull();
  });

  it('hides the overlay immediately when navigating to a finished run, before its snapshot loads', async () => {
    stubRunById('run-suspended-1', runWithSuspendedStep);
    // Delay the finished run's snapshot so there is a window where the streaming
    // `result` still holds the previous (suspended) steps while the route already
    // points at the finished run. The overlay must hide based on the run-accurate
    // snapshot status, not the lagging `result`.
    let resolveFinishedRun: () => void = () => {};
    const finishedRunResolved = new Promise<void>(resolve => {
      resolveFinishedRun = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/run-timeline-1`, async () => {
        await delay(150);
        resolveFinishedRun();
        return HttpResponse.json(runWithTimedSteps);
      }),
    );
    stubWorkflow();

    // Share one QueryClient + a single mounted provider across the rerender so
    // the streaming `result` is not reset by a remount.
    const queryClient = createQueryClient();

    const { rerender } = render(
      <Providers initialRunId="run-suspended-1" queryClient={queryClient}>
        <WorkflowSuspendedOverlay />
      </Providers>,
    );

    // The suspended run shows the overlay.
    expect(await screen.findByTestId('workflow-suspended-overlay')).not.toBeNull();

    // Navigate to a finished run; its snapshot is still loading (delayed 150ms).
    // The streaming `result` still holds the suspended steps during this window.
    rerender(
      <Providers initialRunId="run-timeline-1" queryClient={queryClient}>
        <WorkflowSuspendedOverlay />
      </Providers>,
    );

    // Assert synchronously, before the delayed snapshot resolves: the overlay
    // must already be gone because the route-accurate snapshot is no longer
    // suspended, not because `result` has caught up.
    expect(screen.queryByTestId('workflow-suspended-overlay')).toBeNull();

    // It stays hidden after the finished snapshot resolves too.
    await finishedRunResolved;
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByTestId('workflow-suspended-overlay')).toBeNull();
  });

  it('shows the overlay for a live run that suspends, even with no route runId', async () => {
    stubWorkflow();

    // Simulate what the stream does on `workflow-step-suspended`: it sets the context
    // runId to the freshly-created live run and writes the suspended step into `result`.
    // There is no route runId yet, so the overlay must rely on the streamed `result`.
    const liveSuspendedState: WorkflowRunState = {
      runId: 'live-run-1',
      status: 'suspended',
      value: {},
      context: {
        'step-1': {
          status: 'suspended',
          payload: { reason: 'needs approval' },
          startedAt: Date.now(),
          suspendedAt: Date.now(),
        },
      },
      serializedStepGraph: [],
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: Date.now(),
    };

    function SeedLiveSuspendedRun() {
      const { setRunId, setResult } = useContext(WorkflowRunContext);
      useEffect(() => {
        setRunId('live-run-1');
        setResult(convertWorkflowRunStateToStreamResult(liveSuspendedState));
      }, [setRunId, setResult]);
      return null;
    }

    render(
      <Providers queryClient={createQueryClient()}>
        <SeedLiveSuspendedRun />
        <WorkflowSuspendedOverlay />
      </Providers>,
    );

    expect(await screen.findByTestId('workflow-suspended-overlay')).not.toBeNull();
    expect(screen.getByText('Step suspended')).not.toBeNull();
  });

  it('resumes the workflow when the resume form is submitted', async () => {
    stubRunById('run-suspended-1', runWithSuspendedStep);
    stubWorkflow();

    let createRunHit = false;
    server.use(
      http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/create-run`, () => {
        createRunHit = true;
        return HttpResponse.json({ runId: 'resumed-run-1' });
      }),
    );
    server.use(
      http.post(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/resume-stream`, () =>
        HttpResponse.text('', { headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    );

    renderOverlay('run-suspended-1');

    const resumeButton = await screen.findByRole('button', { name: /resume/i });
    fireEvent.click(resumeButton);

    await waitFor(() => expect(createRunHit).toBe(true));
  });
});
