import type { GetWorkflowResponse, GetWorkflowRunByIdResponse, TimeTravelParams } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowDebugStepControls } from '../workflow-debug-step-controls';
import { beforeBranchRun, debugRun, matchedBranchRun, unfinishedParallelRun } from './fixtures/workflow-debug-runs';
import {
  branchWorkflow,
  nestedWorkflow,
  parallelWorkflow,
  twoStepWorkflow,
} from './fixtures/workflow-debug-step-controls';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function DebugSurface({ isStreaming }: { isStreaming?: boolean }) {
  const { debugMode, setDebugMode, result } = useContext(WorkflowRunContext);
  return (
    <>
      <button onClick={() => setDebugMode(true)}>Enable debug mode</button>
      <output aria-label="Debug mode">{String(debugMode)}</output>
      <output aria-label="Run status">{result?.status}</output>
      <WorkflowDebugStepControls isStreaming={isStreaming} />
    </>
  );
}

async function renderControls(run = debugRun, workflow: GetWorkflowResponse = twoStepWorkflow, isStreaming = false) {
  const onTimeTravel = vi.fn<(params: TimeTravelParams) => void>();
  server.use(
    http.get(`${BASE_URL}/api/workflows/${workflow.name}`, () => HttpResponse.json(workflow)),
    http.get(`${BASE_URL}/api/workflows/${workflow.name}/runs/${run.runId}`, () => HttpResponse.json(run)),
    http.post(`${BASE_URL}/api/workflows/${workflow.name}/create-run`, () => HttpResponse.json({ runId: run.runId })),
    http.post<{}, TimeTravelParams>(
      `${BASE_URL}/api/workflows/${workflow.name}/time-travel-stream`,
      async ({ request }) => {
        onTimeTravel(await request.json());
        return new HttpResponse('');
      },
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <WorkflowRunProvider workflowId={workflow.name} initialRunId={run.runId}>
          <DebugSurface isStreaming={isStreaming} />
        </WorkflowRunProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Run status').textContent).toBe(run.status));
  return onTimeTravel;
}

describe('Workflow debug step controls', () => {
  describe('when a run is not paused', () => {
    it('does not offer step advancement', async () => {
      await renderControls({ ...debugRun, status: 'running' });
      expect(screen.queryByRole('button', { name: /run next step/i })).toBeNull();
    });
  });

  describe('when opening a saved paused run without an in-memory debug flag', () => {
    it('runs its last step to completion with the predecessor output', async () => {
      const request = await renderControls();
      fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'transform',
            inputData: { customerId: 'cus_123' },
            perStep: false,
          }),
        ),
      );
    });

    it('continues the full run and exits debug mode', async () => {
      const request = await renderControls();
      fireEvent.click(screen.getByRole('button', { name: 'Enable debug mode' }));
      fireEvent.click(screen.getByRole('button', { name: /continue full run/i }));
      await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ perStep: false })));
      expect(screen.getByLabelText('Debug mode').textContent).toBe('false');
    });
  });

  describe('when all graph steps have already succeeded', () => {
    it('cannot advance to another step', async () => {
      await renderControls({
        ...debugRun,
        steps: {
          ...debugRun.steps,
          transform: { status: 'success', payload: {}, output: {}, startedAt: 200, endedAt: 300 },
        },
      });
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /run next step/i }).disabled).toBe(true);
    });
  });

  describe('when a conditional branch has one untaken arm', () => {
    it.each(['absent', 'skipped'] as const)(
      'advances past an %s arm without adding its output to the join',
      async state => {
        const run: GetWorkflowRunByIdResponse =
          state === 'absent'
            ? matchedBranchRun
            : {
                ...matchedBranchRun,
                steps: { ...matchedBranchRun.steps, 'long-text': { status: 'skipped', startedAt: 200 } },
              };
        const request = await renderControls(run, branchWorkflow);
        fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
        await waitFor(() =>
          expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
              step: 'mapping_join',
              context: { 'short-text': { status: 'success', output: { text: 'AS' } } },
              perStep: true,
            }),
          ),
        );
      },
    );
  });

  describe('when paused before a branch decision', () => {
    it('sends the predecessor data for the engine to evaluate rather than choosing an arm client-side', async () => {
      const request = await renderControls(beforeBranchRun, branchWorkflow);
      expect(screen.getByText('Evaluate branch conditions')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'short-text',
            inputData: { text: 'A' },
            perStep: true,
          }),
        ),
      );
    });
  });

  describe('when a matching branch arm is paused after its sibling completed', () => {
    it('resumes that arm instead of bypassing it to the join', async () => {
      const request = await renderControls(
        {
          ...matchedBranchRun,
          steps: {
            ...matchedBranchRun.steps,
            'long-text': { status: 'paused', payload: { text: 'A' }, startedAt: 200 },
          },
        },
        branchWorkflow,
      );
      fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ step: 'long-text', perStep: true })),
      );
    });
  });

  describe('when a parallel sibling has not run', () => {
    it('runs the idle sibling instead of advancing to the join', async () => {
      const request = await renderControls(unfinishedParallelRun, parallelWorkflow);
      fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ step: 'add-letter-c', perStep: true })),
      );
    });
  });

  describe('when the next step is a nested workflow', () => {
    it('runs it atomically while preserving debug mode for subsequent top-level steps', async () => {
      const request = await renderControls({ ...beforeBranchRun, workflowName: nestedWorkflow.name }, nestedWorkflow);
      fireEvent.click(screen.getByRole('button', { name: 'Enable debug mode' }));
      fireEvent.click(screen.getByRole('button', { name: /run next step/i }));
      await waitFor(() =>
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({ step: 'nested-text-processor', perStep: false }),
        ),
      );
      expect(screen.getByLabelText('Debug mode').textContent).toBe('true');
    });
  });

  describe('when an advance is already streaming', () => {
    it('disables both advancement actions', async () => {
      await renderControls(debugRun, twoStepWorkflow, true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /run next step/i }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /continue full run/i }).disabled).toBe(true);
    });
  });
});
