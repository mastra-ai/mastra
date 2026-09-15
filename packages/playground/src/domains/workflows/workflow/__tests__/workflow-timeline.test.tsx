import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkflowStepDetailContent } from '../../components/workflow-step-detail';
import { completedLoop } from '../../context/__tests__/fixtures/completed-loop';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../../context/workflow-step-detail-provider';
import { WorkflowTimeline } from '../workflow-timeline';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function renderTimeline(run = completedLoop) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, () => HttpResponse.json(run)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkflowStepDetailProvider>
          <WorkflowRunProvider workflowId="two-step-workflow" initialRunId="completed-loop">
            <WorkflowSelectedStepProvider>
              <WorkflowTimeline />
              <WorkflowStepDetailContent />
            </WorkflowSelectedStepProvider>
          </WorkflowRunProvider>
        </WorkflowStepDetailProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('WorkflowTimeline', () => {
  describe('when a loop iteration has completed', () => {
    it('reveals its input independently from selecting a graph node', async () => {
      renderTimeline();
      fireEvent.click(await screen.findByRole('button', { name: 'Expand timeline' }));
      expect(await screen.findByText('count-words')).not.toBeNull();
      expect(screen.getByText('analyze-document[0]')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'View step input' }));
      expect(await screen.findByRole('region', { name: 'Data inspector' })).not.toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { name: 'analyze-document[0].count-words' })).not.toBeNull();
    });

    it('collapses its events while keeping the timeline control reachable', async () => {
      renderTimeline();
      fireEvent.click(await screen.findByRole('button', { name: 'Expand timeline' }));
      await screen.findByText('count-words');
      fireEvent.click(screen.getByRole('button', { name: 'Collapse timeline' }));
      expect(await screen.findByRole('button', { name: 'Expand timeline' })).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'View step input' })).toBeNull());
    });

    it('enlarges the timeline without losing its events or collapse control', async () => {
      renderTimeline();
      fireEvent.click(await screen.findByRole('button', { name: 'Expand timeline' }));
      fireEvent.click(screen.getByRole('button', { name: 'Enlarge timeline' }));
      expect(screen.getByRole('button', { name: 'Restore timeline height' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByText('count-words')).not.toBeNull();
      expect(screen.getByTestId('workflow-timeline-bar')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Collapse timeline' }));
      fireEvent.click(screen.getByRole('button', { name: 'Expand timeline' }));
      expect(screen.getByRole('button', { name: 'Restore timeline height' }).getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Restore timeline height' }));
      expect(screen.getByRole('button', { name: 'Enlarge timeline' }).getAttribute('aria-pressed')).toBe('false');
    });
  });
});

describe('WorkflowTimeline status fallback', () => {
  describe('when a stored step is paused', () => {
    it('preserves the step and its inspectable input', async () => {
      renderTimeline({
        ...completedLoop,
        status: 'paused',
        steps: {
          review: { status: 'paused', startedAt: 100, payload: { title: 'Review' } },
        },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Expand timeline' }));
      expect(await screen.findByLabelText('Paused')).not.toBeNull();
      expect(screen.getByLabelText('Timing unavailable')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'View step input' }));
      expect(await screen.findByRole('heading', { name: 'review' })).not.toBeNull();
    });
  });
});

describe('WorkflowTimeline unknown status', () => {
  describe('when the server sends a status this Studio version does not know', () => {
    it.each(['future-status', '__proto__'])('keeps %s inspectable', async status => {
      renderTimeline({
        ...completedLoop,
        steps: JSON.parse(
          JSON.stringify({
            review: { status, startedAt: 100, endedAt: 200, payload: { title: 'Review' } },
          }),
        ),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Expand timeline' }));
      expect(await screen.findByLabelText('Status unavailable')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'View step input' }));
      expect(await screen.findByRole('heading', { name: 'review' })).not.toBeNull();
    });
  });
});
