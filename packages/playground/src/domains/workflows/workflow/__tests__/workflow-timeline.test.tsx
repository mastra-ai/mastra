// @vitest-environment jsdom
import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function stubRunById(runId: string, response: GetWorkflowRunByIdResponse, onRequest?: () => void) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${runId}`, () => {
      onRequest?.();
      return HttpResponse.json(response);
    }),
  );
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

  return { ...render(timelineUi(queryClient, initialRunId)), queryClient };
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
    const onRunRequest = vi.fn();
    stubRunById('run-timeline-empty', runWithOnlyInput, onRunRequest);
    stubWorkflow();

    const { container, queryClient } = renderTimeline('run-timeline-empty');

    await waitFor(() => expect(onRunRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
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
    expect(rows[0].getAttribute('role')).toBe('button');
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

  it('positions itself over the graph from the workflow left panel width variable', async () => {
    stubRunById('run-timeline-1', runWithTimedSteps);
    stubWorkflow();

    renderTimeline('run-timeline-1');

    await screen.findByText('Step A');

    const timeline = screen.getByTestId('workflow-timeline');
    expect(timeline.className).toContain('absolute');
    expect(timeline.className).toContain('bottom-0');
    expect(timeline.style.left).toBe('var(--workflow-left-panel-width, 0px)');
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

  it('reuses workflow card badge indicators for timeline rows', async () => {
    const startedAt = new Date(2026, 4, 29, 16, 19, 44).getTime();
    const steps: Record<string, Step> = {
      'sleep-step': {
        status: 'success',
        startedAt,
        endedAt: startedAt + 1000,
        duration: 1000,
      },
      'suspend-step': {
        status: 'suspended',
        startedAt: startedAt + 1000,
        endedAt: startedAt + 2000,
        canSuspend: true,
      },
    };

    renderControlledTimeline(steps);

    expect(await screen.findByTestId('workflow-card-indicator-sleep')).not.toBeNull();
    expect(screen.getByTestId('workflow-card-indicator-suspend')).not.toBeNull();
  });

  it('opens step input and output JSON dialogs from timeline action buttons', async () => {
    const startedAt = new Date(2026, 4, 29, 16, 19, 44).getTime();
    const steps: Record<string, Step & { payload?: unknown }> = {
      'io-step': {
        status: 'success',
        startedAt,
        endedAt: startedAt + 1000,
        payload: { prompt: 'hello' },
        output: { answer: 'world' },
      },
    };

    renderControlledTimeline(steps);

    await screen.findByText('Io Step');

    fireEvent.click(screen.getByRole('button', { name: 'View step input' }));
    expect(await screen.findByText('Io Step input')).not.toBeNull();
    expect(screen.getByText(/prompt/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'View step output' }));
    expect(await screen.findByText('Io Step output')).not.toBeNull();
    expect(screen.getByText(/answer/)).not.toBeNull();
  });

  it('keeps timeline input and output buttons visible but disabled for running steps', async () => {
    const startedAt = new Date(2026, 4, 29, 16, 19, 44).getTime();
    const steps = {
      'running-step': {
        status: 'running',
        startedAt,
        payload: { prompt: 'hello' },
      },
    } satisfies Record<string, Step & { payload?: unknown }>;

    renderControlledTimeline(steps);

    await screen.findByText('Running Step');

    const inputButton = screen.getByRole('button', { name: 'View step input' });
    const outputButton = screen.getByRole('button', { name: 'View step output' });

    expect(inputButton.hasAttribute('disabled')).toBe(true);
    expect(outputButton.hasAttribute('disabled')).toBe(true);
  });

  it('marks nested timeline entries disabled without changing hover or selection', async () => {
    const startedAt = new Date(2026, 4, 29, 16, 19, 44).getTime();
    const steps = {
      'parent.child': {
        status: 'success',
        startedAt,
        endedAt: startedAt + 1000,
        payload: { nested: true },
      },
    } satisfies Record<string, Step & { payload?: unknown }>;

    renderControlledTimeline(steps);

    await screen.findByText('Parent Child');

    const row = screen.getByTestId('workflow-timeline-row');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.getAttribute('data-workflow-step-nested')).toBe('true');

    fireEvent.mouseEnter(row);
    expect(row.getAttribute('data-workflow-step-hovered')).toBeNull();

    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(row.getAttribute('data-workflow-step-active')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View step input' }));
    expect(await screen.findByText('Parent Child input')).not.toBeNull();
  });
});
