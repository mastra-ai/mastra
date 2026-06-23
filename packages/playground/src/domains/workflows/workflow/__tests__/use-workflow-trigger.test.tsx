// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { useSuspendedSteps, useWaitingStepKey } from '../use-workflow-trigger';
import { branchWorkflow, twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import {
  pausedRunAfterFirstStepState,
  pausedRunBranchResolvedState,
  pausedRunNoStepsState,
  successfulRunState,
  suspendedRunState,
} from './fixtures/workflow-run-states';
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Serve the two endpoints `WorkflowRunProvider` hits on mount for a `:runId` page:
// the workflow definition (for the step graph) and the run-by-id execution result.
function serveWorkflowRun(workflowId: string, workflow: GetWorkflowResponse, run: GetWorkflowRunByIdResponse) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/${workflowId}`, () => HttpResponse.json(workflow)),
    http.get(`${BASE_URL}/api/workflows/${workflowId}/runs/${run.runId}`, () => HttpResponse.json(run)),
  );
}

function renderWithRun(workflowId: string, runId: string, probe: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkflowRunProvider workflowId={workflowId} initialRunId={runId}>
          {probe}
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('useSuspendedSteps', () => {
  // Reads the live run result out of context, exactly as the trigger UI does. Also surfaces
  // the loaded run status so tests can deterministically await the converted result.
  function WaitingAndSuspendedProbe() {
    const { result, runId } = useContext(WorkflowRunContext);
    const suspended = useSuspendedSteps(result, runId ?? '');
    return (
      <>
        <div data-testid="status">{result?.status ?? 'none'}</div>
        <ul data-testid="suspended">
          {suspended.map(step => (
            <li key={step.stepId} data-step-id={step.stepId} data-payload={JSON.stringify(step.suspendPayload)}>
              {step.stepId}
            </li>
          ))}
        </ul>
      </>
    );
  }

  describe('when the run has a suspended step', () => {
    it('surfaces only the suspended step with its payload and run id', async () => {
      serveWorkflowRun('two-step-workflow', twoStepWorkflow, suspendedRunState);

      renderWithRun('two-step-workflow', suspendedRunState.runId, <WaitingAndSuspendedProbe />);

      const items = await waitFor(() => {
        const found = screen.getByTestId('suspended').querySelectorAll('li');
        if (found.length === 0) throw new Error('no suspended steps yet');
        return found;
      });

      expect(items).toHaveLength(1);
      expect(items[0].getAttribute('data-step-id')).toBe('transform');
      expect(items[0].getAttribute('data-payload')).toBe(JSON.stringify({ question: 'continue?' }));
    });
  });

  describe('when no step is suspended', () => {
    it('renders no suspended steps', async () => {
      // A success run resolves to the same `transform` step id used by the suspended fixture,
      // so reaching the loaded state and finding no suspended <li> proves the status gate,
      // not just an unloaded run.
      serveWorkflowRun('two-step-workflow', twoStepWorkflow, successfulRunState);

      renderWithRun('two-step-workflow', successfulRunState.runId, <WaitingAndSuspendedProbe />);

      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
      expect(screen.getByTestId('suspended').querySelectorAll('li')).toHaveLength(0);
    });
  });
});

describe('useWaitingStepKey', () => {
  function WaitingProbe() {
    const stepKey = useWaitingStepKey();
    return <div data-testid="waiting">{stepKey ?? 'none'}</div>;
  }

  describe('when the run is not paused', () => {
    it('does not wait on any step', async () => {
      serveWorkflowRun('two-step-workflow', twoStepWorkflow, successfulRunState);

      renderWithRun('two-step-workflow', successfulRunState.runId, <WaitingProbe />);

      await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('none'));
    });
  });

  describe('when a paused run has not started any step', () => {
    it('waits on the first step in graph order', async () => {
      serveWorkflowRun('two-step-workflow', twoStepWorkflow, pausedRunNoStepsState);

      renderWithRun('two-step-workflow', pausedRunNoStepsState.runId, <WaitingProbe />);

      await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('extract'));
    });
  });

  describe('when a paused run has completed the first step', () => {
    it('waits on the next unfinished step', async () => {
      serveWorkflowRun('two-step-workflow', twoStepWorkflow, pausedRunAfterFirstStepState);

      renderWithRun('two-step-workflow', pausedRunAfterFirstStepState.runId, <WaitingProbe />);

      await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('transform'));
    });
  });

  describe('when a paused run resolved a conditional branch', () => {
    it('skips the un-taken arm and waits on the join step', async () => {
      // The conditional resolved to `long-text`, so `short-text` was never run and has no
      // result. The waited step must jump past the never-taken arm to the join.
      serveWorkflowRun('branch-workflow', branchWorkflow, pausedRunBranchResolvedState);

      renderWithRun('branch-workflow', pausedRunBranchResolvedState.runId, <WaitingProbe />);

      await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('mapping_join'));
    });
  });
});
