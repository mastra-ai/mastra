// @vitest-environment jsdom
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { baseWorkflow } from '../../components/__tests__/fixtures/workflow';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { runWithOnlyInput, runWithTimedSteps } from '../../runs/__tests__/fixtures/workflow-runs';
import { WorkflowTimeline } from '../workflow-timeline';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'demo-workflow';

function stubWorkflow() {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(baseWorkflow)));
}

function stubRunById(runId: string, response: GetWorkflowRunByIdResponse) {
  server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${runId}`, () => HttpResponse.json(response)));
}

function renderTimeline(initialRunId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
          <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
            <WorkflowTimeline />
          </WorkflowRunProvider>
        </TracingSettingsProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(cleanup);

describe('WorkflowTimeline', () => {
  it('renders nothing when there is no active run', () => {
    stubWorkflow();

    const { container } = renderTimeline();
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the run has no non-input steps', async () => {
    stubRunById('run-timeline-empty', runWithOnlyInput);
    stubWorkflow();

    const { container } = renderTimeline('run-timeline-empty');

    // Give the query a tick to resolve, then assert still empty.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(container.querySelector('[data-testid="workflow-timeline"]')).toBeNull();
  });

  it('renders one row per non-input step with a title-cased label', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    expect(await screen.findByText('Step A')).not.toBeNull();
    expect(screen.getByText('Step B')).not.toBeNull();
    expect(screen.getByText('Step C')).not.toBeNull();

    const rows = screen.getAllByTestId('workflow-timeline-row');
    expect(rows.length).toBe(3);
  });

  it('positions and sizes itself from the workflow left panel width variable', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    await screen.findByText('Step A');

    const timeline = screen.getByTestId('workflow-timeline');
    expect(timeline.style.marginLeft).toBe('var(--workflow-left-panel-width, 0px)');
    expect(timeline.style.width).toBe('calc(100% - var(--workflow-left-panel-width, 0px))');
  });

  it('positions and sizes each bar from step timing', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    await screen.findByText('Step A');

    const bars = screen.getAllByTestId('workflow-timeline-bar');
    // step-a: offset 0, width 1000/3000+ of the run
    expect(bars[0].getAttribute('data-offset')).toBe('0');
    // step-b: offset = 1000 / total
    expect(Number(bars[1].getAttribute('data-offset'))).toBeGreaterThan(0);
  });

  it('shows a duration label in seconds for completed steps', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    await screen.findByText('Step A');

    await waitFor(() => {
      expect(screen.getByText('1s')).not.toBeNull();
      expect(screen.getAllByText(/s$/).length).toBeGreaterThan(0);
    });
  });
});
