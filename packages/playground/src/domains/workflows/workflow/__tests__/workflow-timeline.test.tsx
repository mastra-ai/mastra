// @vitest-environment jsdom
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { baseWorkflow } from '../../components/__tests__/fixtures/workflow';
import type { Step } from '../../context/use-current-run';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
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

function timelineUi(queryClient: QueryClient, initialRunId?: string) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
          <WorkflowSelectedStepProvider>
            <WorkflowRunProvider workflowId={WORKFLOW_ID} initialRunId={initialRunId}>
              <WorkflowTimeline />
            </WorkflowRunProvider>
          </WorkflowSelectedStepProvider>
        </TracingSettingsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function renderTimeline(initialRunId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(timelineUi(queryClient, initialRunId));
}

function renderRerenderableTimeline(initialRunId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(timelineUi(queryClient, initialRunId));

  return {
    ...rendered,
    rerenderRoute(nextRunId?: string) {
      rendered.rerender(timelineUi(queryClient, nextRunId));
    },
  };
}

function controlledTimelineUi(steps: Record<string, Step>) {
  return (
    <WorkflowSelectedStepProvider>
      <WorkflowRunContext.Provider value={{ result: { steps } } as never}>
        <WorkflowTimeline />
      </WorkflowRunContext.Provider>
    </WorkflowSelectedStepProvider>
  );
}

function renderControlledTimeline(steps: Record<string, Step>) {
  const rendered = render(controlledTimelineUi(steps));

  return {
    ...rendered,
    rerenderSteps(nextSteps: Record<string, Step>) {
      rendered.rerender(controlledTimelineUi(nextSteps));
    },
  };
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
    expect(rows[0].tagName).toBe('BUTTON');
  });

  it('marks timeline rows as hovered and selected from pointer and click interactions', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    await screen.findByText('Step A');

    const firstRow = screen.getAllByTestId('workflow-timeline-row')[0];
    expect(firstRow.getAttribute('aria-pressed')).toBe('false');

    fireEvent.mouseEnter(firstRow);
    expect(firstRow.getAttribute('data-workflow-step-hovered')).toBe('true');

    fireEvent.click(firstRow);
    expect(firstRow.getAttribute('aria-pressed')).toBe('true');
    expect(firstRow.getAttribute('data-workflow-step-active')).toBe('true');

    fireEvent.mouseLeave(firstRow);
    expect(firstRow.getAttribute('data-workflow-step-hovered')).toBeNull();
  });

  it('collapses and expands timeline rows from the header caret', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    expect(await screen.findByText('Step A')).not.toBeNull();

    const collapseButton = screen.getByRole('button', { name: 'Collapse timeline' });
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(collapseButton);
    expect(screen.queryByTestId('workflow-timeline-row')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand timeline' }).getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Expand timeline' }));
    expect(screen.getAllByTestId('workflow-timeline-row').length).toBe(3);
  });

  it('scrolls to the bottom when the timeline list grows', async () => {
    const startedAt = new Date(2026, 4, 29, 16, 19, 44).getTime();
    const firstStep = {
      'step-a': { status: 'success', startedAt, endedAt: startedAt + 1000 },
    } satisfies Record<string, Step>;
    const grownSteps = {
      ...firstStep,
      'step-b': { status: 'success', startedAt: startedAt + 1000, endedAt: startedAt + 2000 },
      'step-c': { status: 'running', startedAt: startedAt + 2000 },
    } satisfies Record<string, Step>;

    const { rerenderSteps } = renderControlledTimeline(firstStep);

    await screen.findByText('Step A');
    const list = screen.getByTestId('workflow-timeline-list');
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 420 });

    rerenderSteps(grownSteps);

    await waitFor(() => {
      expect(list.scrollTop).toBe(420);
    });
  });

  it('clears run timeline rows when returning from a run route to the base workflow route', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    const { rerenderRoute } = renderRerenderableTimeline('run-timeline-1');

    expect(await screen.findByText('Step A')).not.toBeNull();

    rerenderRoute();

    await waitFor(() => {
      expect(screen.queryByTestId('workflow-timeline')).toBeNull();
    });
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
