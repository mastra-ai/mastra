import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { useWorkflowStepDetail } from '../../context/workflow-step-detail-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowDataButton } from '../data/workflow-data-button';
import { WorkflowDataInspector } from '../data/workflow-data-inspector';
import { WorkflowSuspendedOverlay } from '../workflow-suspended-overlay';
import { inspectionWorkflow, suspendedRunWithOutput } from './fixtures/workflow-data-inspector';
import { suspendedRunState, successfulRunState } from './fixtures/workflow-run-states';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function InspectionSurface() {
  const { stepDetail } = useWorkflowStepDetail();
  return (
    <>
      <input aria-label="Canvas state" defaultValue="Keep this view" />
      <WorkflowDataButton selection={{ type: 'step-output', stepId: 'extract' }} />
      <WorkflowDataButton selection={{ type: 'step-input', stepId: 'transform' }} />
      <WorkflowSuspendedOverlay hidden={Boolean(stepDetail)} />
      {stepDetail?.type === 'data' && <WorkflowDataInspector selection={stepDetail.selection} />}
    </>
  );
}

function RunSelection() {
  const [runId, setRunId] = useState(suspendedRunState.runId);
  return (
    <>
      <button onClick={() => setRunId(successfulRunState.runId)}>View successful run</button>
      <button onClick={() => setRunId(suspendedRunState.runId)}>View suspended run</button>
      <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={runId}>
        <InspectionSurface />
      </WorkflowRunProvider>
    </>
  );
}

function renderInspector() {
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(inspectionWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/run-suspended`, () =>
      HttpResponse.json(suspendedRunState),
    ),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/run-success`, () =>
      HttpResponse.json(successfulRunState),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkflowStepDetailProvider>
            <RunSelection />
          </WorkflowStepDetailProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return queryClient;
}

describe('Workflow data inspector', () => {
  describe('when inspecting a suspended run', () => {
    it('opens the recorded data inline and restores the suspended controls and trigger focus on close', async () => {
      renderInspector();
      const trigger = await screen.findByRole('button', { name: 'View extract output' });
      fireEvent.change(await screen.findByRole('textbox', { name: /^Note/ }), {
        target: { value: 'Review once inventory is confirmed' },
      });
      fireEvent.click(trigger);
      const panel = screen.getByRole('region', { name: 'Data inspector' });
      expect(within(panel).getByText(/cus_123/)).not.toBeNull();
      expect(panel.querySelector('[contenteditable="true"]')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Step suspended' })).toBeNull();
      expect(trigger.getAttribute('aria-pressed')).toBe('true');
      fireEvent.keyDown(panel, { key: 'Escape' });
      expect(screen.queryByRole('region', { name: 'Data inspector' })).toBeNull();
      expect(screen.getByRole('region', { name: 'Step suspended' })).not.toBeNull();
      expect(screen.getByDisplayValue('Review once inventory is confirmed')).not.toBeNull();
      expect(trigger.getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    });

    it('replaces the inspected data without remounting the canvas', async () => {
      renderInspector();
      const canvasState = screen.getByRole('textbox', { name: 'Canvas state' });
      fireEvent.change(canvasState, { target: { value: 'Panned canvas' } });
      fireEvent.click(await screen.findByRole('button', { name: 'View extract output' }));
      fireEvent.click(screen.getByRole('button', { name: 'View transform input' }));
      const panel = screen.getByRole('region', { name: 'Data inspector' });
      expect(within(panel).getByRole('heading', { name: 'transform' })).not.toBeNull();
      expect(within(panel).getByText(/"request"/)).not.toBeNull();
      expect(within(panel).queryByText(/cus_123/)).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Canvas state' })).toBe(canvasState);
      expect(screen.getByDisplayValue('Panned canvas')).toBe(canvasState);
    });

    it.each([
      { output: false, text: 'false' },
      { output: null, text: 'null' },
    ])('shows updated $text output instead of retaining the payload from the click', async ({ output, text }) => {
      const queryClient = renderInspector();
      fireEvent.click(await screen.findByRole('button', { name: 'View extract output' }));
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/run-suspended`, () =>
          HttpResponse.json(suspendedRunWithOutput(output)),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['workflow-run', 'two-step-workflow', 'run-suspended'] });
      await waitFor(() =>
        expect(within(screen.getByRole('region', { name: 'Data inspector' })).getByText(text)).not.toBeNull(),
      );
    });
  });

  describe('when switching to another run', () => {
    it('clears inspection and does not restore stale selection when returning', async () => {
      renderInspector();
      fireEvent.click(await screen.findByRole('button', { name: 'View extract output' }));
      fireEvent.click(screen.getByRole('button', { name: 'View successful run' }));
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Data inspector' })).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'View suspended run' }));
      await screen.findByTestId('workflow-suspended-overlay');
      expect(screen.queryByRole('region', { name: 'Data inspector' })).toBeNull();
    });
  });
});
