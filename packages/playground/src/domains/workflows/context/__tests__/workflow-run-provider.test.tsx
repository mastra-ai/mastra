import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useContext, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { convertWorkflowRunStateToStreamResult } from '../../utils';
import { twoStepWorkflow } from '../../workflow/__tests__/fixtures/workflow-debug-step-controls';
import { WorkflowTimeline } from '../../workflow/workflow-timeline';
import { WorkflowRunContext } from '../workflow-run-context';
import { WorkflowRunProvider } from '../workflow-run-provider';
import { WorkflowSelectedStepProvider } from '../workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../workflow-step-detail-provider';
import {
  completedIterationArray,
  completedLoop,
  partialCompletedLoop,
  pausedLoop,
  rawCompletedRun,
  suspendedLoop,
} from './fixtures/completed-loop';
import { completedChunks, replayedChunks, runningChunk } from './fixtures/workflow-stream';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
afterEach(cleanup);

function CompletedRunProbe() {
  const [streamFinished, setStreamFinished] = useState(false);
  const {
    result,
    setResult,
    setRunId,
    clearData,
    resumeWorkflow,
    streamWorkflow,
    timeTravelWorkflowStream,
    observeWorkflowStream,
    isStreamingWorkflow,
  } = useContext(WorkflowRunContext);
  return (
    <>
      <button
        onClick={() => {
          setRunId(completedLoop.runId);
          setResult({ status: 'success', input: {}, result: {}, steps: {} });
        }}
      >
        Finish run
      </button>
      <button
        onClick={() => {
          clearData();
          setRunId('');
        }}
      >
        New run
      </button>
      <button
        onClick={() =>
          resumeWorkflow({
            workflowId: 'two-step-workflow',
            runId: completedLoop.runId,
            step: 'review',
            resumeData: { approved: true },
            requestContext: {},
          })
        }
      >
        Approve
      </button>
      <button
        onClick={async () => {
          setRunId('live-run');
          await streamWorkflow({
            workflowId: 'two-step-workflow',
            runId: 'live-run',
            inputData: {},
            requestContext: {},
          });
          setStreamFinished(true);
        }}
      >
        Stream run
      </button>
      <button
        onClick={() => {
          setRunId('next-run');
          void streamWorkflow({
            workflowId: 'two-step-workflow',
            runId: 'next-run',
            inputData: { next: true },
            requestContext: {},
          });
        }}
      >
        Stream another run
      </button>
      <button onClick={() => setResult(null)}>Clear result</button>
      <button onClick={() => setResult(result && { ...result, status: 'canceled' })}>Mark canceled</button>
      <button
        onClick={() =>
          void timeTravelWorkflowStream({
            workflowId: 'two-step-workflow',
            runId: completedLoop.runId,
            step: 'review',
            inputData: {},
            requestContext: {},
          })
        }
      >
        Replay run
      </button>
      <button
        onClick={() =>
          observeWorkflowStream?.({
            workflowId: 'two-step-workflow',
            runId: completedLoop.runId,
            storedStatus: result?.status,
          })
        }
      >
        Observe run
      </button>
      <output aria-label="Stream completion">{streamFinished ? 'Finished' : 'Pending'}</output>
      <output aria-label="Streaming state">{String(isStreamingWorkflow)}</output>
      <output aria-label="Run state">{result?.status}</output>
      <output aria-label="Step IDs">{JSON.stringify(Object.keys(result?.steps ?? {}))}</output>
      <output aria-label="Child state">
        {result?.steps['analyze-document[0].count-words']?.status ?? 'No child state'}
      </output>
      <output aria-label="Child output">
        {JSON.stringify(result?.steps['analyze-document[0].count-words']?.output)}
      </output>
      <output aria-label="Persisted state">{result?.steps.persisted?.status}</output>
      <output aria-label="Iteration state">{result?.steps.transform?.status}</output>
      <output aria-label="Iteration input">{JSON.stringify(result?.steps.transform?.payload)}</output>
      <output aria-label="Iteration output">{JSON.stringify(result?.steps.transform?.output)}</output>
      <output aria-label="Iteration metadata">{JSON.stringify(result?.steps.transform?.metadata)}</output>
    </>
  );
}

function renderProvider(initialRunId?: string, children?: ReactNode) {
  server.use(http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (runId?: string) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkflowStepDetailProvider>
          <WorkflowRunProvider workflowId="two-step-workflow" initialRunId={runId}>
            <CompletedRunProbe />
            {children}
          </WorkflowRunProvider>
        </WorkflowStepDetailProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const view = render(tree(initialRunId));
  return { ...view, selectRun: (runId?: string) => view.rerender(tree(runId)) };
}

describe('WorkflowRunProvider', () => {
  beforeEach(() => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, () =>
        HttpResponse.json(completedLoop),
      ),
    );
  });

  describe('when completed iterations are stored as an array', () => {
    it('retains every iteration input and output for inspection', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, () =>
          HttpResponse.json(completedIterationArray),
        ),
      );
      renderProvider(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Iteration state').textContent).toBe('success'));
      expect(screen.getByLabelText('Iteration input').textContent).toBe('[false,0,"",null]');
      expect(screen.getByLabelText('Iteration output').textContent).toBe('[0,false,null,""]');
      expect(screen.getByLabelText('Iteration metadata').textContent).toBe(
        '{"application":{"untouched":[null,false]}}',
      );
    });
  });

  describe('when a snapshot omits step details', () => {
    it('keeps the recorded status without inventing step data or timings', () => {
      const result = convertWorkflowRunStateToStreamResult(partialCompletedLoop);
      expect(result.steps.persisted).toEqual({ status: 'success', startedAt: 100, endedAt: 110 });
      expect(Object.keys(result.steps)).toContain('__proto__');
      expect(result.steps['__proto__'].output).toBe(false);
      expect(convertWorkflowRunStateToStreamResult({ ...completedLoop, steps: undefined }).steps).toEqual({});
    });
  });

  describe('when the snapshot is a raw WorkflowRunState', () => {
    it('retains its completed step data and workflow result', () => {
      const result = convertWorkflowRunStateToStreamResult(rawCompletedRun);
      expect(result.steps.transform).toEqual({
        status: 'success',
        payload: 0,
        output: false,
        startedAt: 100,
        endedAt: 110,
      });
      expect(result.result).toEqual({ accepted: false });
    });
  });

  describe('when a run streams without an input panel mounted', () => {
    it('updates the shared execution state', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: 'live-run' }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/stream`,
          () => new HttpResponse(JSON.stringify(runningChunk) + '\x1e'),
        ),
      );
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('running'));
    });
  });

  describe('when the previous result is cleared before the next run starts', () => {
    it('shows the next run as it streams', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: 'live-run' }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/stream`,
          () => new HttpResponse(JSON.stringify(runningChunk) + '\x1e'),
        ),
      );
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Clear result' }));
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('running'));
    });
  });

  describe('when an old stream connects after selecting a saved run', () => {
    it('keeps the saved run selected', async () => {
      let connectStream = () => {};
      let streamRequested = () => {};
      const connection = new Promise<void>(resolve => {
        connectStream = resolve;
      });
      const requested = new Promise<void>(resolve => {
        streamRequested = resolve;
      });
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: 'live-run' }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/stream`, async () => {
          streamRequested();
          await connection;
          return new HttpResponse(JSON.stringify(runningChunk) + '\x1e');
        }),
      );
      const view = renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await requested;
      view.selectRun(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('success'));
      connectStream();
      await waitFor(() => expect(screen.getByLabelText('Stream completion').textContent).toBe('Finished'));
      expect(screen.getByLabelText('Streaming state').textContent).toBe('false');
      expect(screen.getByLabelText('Run state').textContent).toBe('success');
    });
  });

  describe('when a superseded stream connects during the next run', () => {
    it('does not replace or stop the active stream', async () => {
      let connectOldStream = () => {};
      let oldStreamRequested = () => {};
      const oldConnection = new Promise<void>(resolve => {
        connectOldStream = resolve;
      });
      const oldRequest = new Promise<void>(resolve => {
        oldStreamRequested = resolve;
      });
      let finishNextStream = () => {};
      const nextBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...runningChunk, runId: 'next-run' }) + '\x1e'));
          finishNextStream = () => controller.close();
        },
      });
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, ({ request }) =>
          HttpResponse.json({ runId: new URL(request.url).searchParams.get('runId') }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/stream`, async ({ request }) => {
          if (new URL(request.url).searchParams.get('runId') === 'next-run') return new HttpResponse(nextBody);
          oldStreamRequested();
          await oldConnection;
          return new HttpResponse(completedChunks.map(chunk => JSON.stringify(chunk) + '\x1e').join(''));
        }),
      );
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await oldRequest;
      fireEvent.click(screen.getByRole('button', { name: 'Stream another run' }));
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('running'));
      connectOldStream();
      await waitFor(() => expect(screen.getByLabelText('Stream completion').textContent).toBe('Finished'));
      expect(screen.getByLabelText('Run state').textContent).toBe('running');
      expect(screen.getByLabelText('Streaming state').textContent).toBe('true');
      finishNextStream();
      await waitFor(() => expect(screen.getByLabelText('Streaming state').textContent).toBe('false'));
    });
  });

  describe('when selecting an uncached run', () => {
    it('clears the previous result while the selected run loads', async () => {
      let finishLoading = () => {};
      const loading = new Promise<void>(resolve => {
        finishLoading = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/another-run`, async () => {
          await loading;
          return HttpResponse.json({ ...suspendedLoop, runId: 'another-run' });
        }),
      );
      const view = renderProvider(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('success'));
      view.selectRun('another-run');
      expect(screen.getByLabelText('Run state').textContent).toBe('');
      expect(screen.getByLabelText('Child state').textContent).toBe('No child state');
      finishLoading();
      await screen.findByText('suspended');
      view.selectRun();
      expect(screen.getByLabelText('Run state').textContent).toBe('');
    });
  });

  describe('when a stored run resumes', () => {
    it('refreshes persisted child states after the resume stream closes', async () => {
      let resumed = false;
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, () =>
          HttpResponse.json(resumed ? completedLoop : suspendedLoop),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: completedLoop.runId }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/resume-stream`, () => {
          resumed = true;
          return new HttpResponse('');
        }),
      );
      renderProvider(completedLoop.runId);
      await screen.findByText('suspended');
      fireEvent.click(screen.getByRole('button', { name: 'Observe run' }));
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      await waitFor(() => expect(screen.getByLabelText('Child state').textContent).toBe('success'));
    });
  });

  describe('when opening a paused run', () => {
    it('keeps continuation available while observing remote progress', async () => {
      let observeStarted = false;
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
      });
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, () =>
          HttpResponse.json(pausedLoop),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: completedLoop.runId }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/observe`, () => {
          observeStarted = true;
          return new HttpResponse(stream);
        }),
      );
      renderProvider(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('paused'));
      fireEvent.click(screen.getByRole('button', { name: 'Observe run' }));
      await waitFor(() => expect(observeStarted).toBe(true));
      expect(screen.getByLabelText('Run state').textContent).toBe('paused');
      expect(screen.getByLabelText('Streaming state').textContent).toBe('false');
      await act(async () => {
        streamController.enqueue(
          new TextEncoder().encode(
            completedChunks.map(chunk => JSON.stringify({ ...chunk, runId: completedLoop.runId }) + '\x1e').join(''),
          ),
        );
        streamController.close();
      });
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('success'));
      expect(screen.getByLabelText('Child output').textContent).toBe('{"words":2}');
    });
  });

  describe('when replaying a locally canceled run', () => {
    it('uses the new stream instead of the canceled override', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: completedLoop.runId }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/time-travel-stream`,
          () => new HttpResponse(JSON.stringify({ ...runningChunk, runId: completedLoop.runId }) + '\x1e'),
        ),
      );
      renderProvider(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('success'));
      fireEvent.click(screen.getByRole('button', { name: 'Mark canceled' }));
      expect(screen.getByLabelText('Run state').textContent).toBe('canceled');
      fireEvent.click(screen.getByRole('button', { name: 'Replay run' }));
      await waitFor(() => expect(screen.getByLabelText('Run state').textContent).toBe('running'));
    });
  });

  describe('when a successful replay finishes before its snapshot refresh', () => {
    it('keeps the new output while supplementing it with persisted step details', async () => {
      let replayed = false;
      let refreshStarted = false;
      let releaseSnapshot!: () => void;
      const snapshotPending = new Promise<void>(resolve => {
        releaseSnapshot = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/completed-loop`, async () => {
          if (!replayed) return HttpResponse.json(completedLoop);
          refreshStarted = true;
          await snapshotPending;
          return HttpResponse.json({ ...partialCompletedLoop, runId: completedLoop.runId });
        }),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: completedLoop.runId }),
        ),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/time-travel-stream`, () => {
          replayed = true;
          return new HttpResponse(replayedChunks.map(chunk => JSON.stringify(chunk) + '\x1e').join(''));
        }),
      );
      renderProvider(completedLoop.runId);
      await waitFor(() => expect(screen.getByLabelText('Child output').textContent).toBe('{"words":2}'));
      fireEvent.click(screen.getByRole('button', { name: 'Replay run' }));
      try {
        await waitFor(() => expect(refreshStarted).toBe(true));
        expect(screen.getByLabelText('Streaming state').textContent).toBe('false');
        expect(screen.getByLabelText('Child output').textContent).toBe('{"words":9}');
      } finally {
        releaseSnapshot();
      }
      await waitFor(() => expect(screen.getByLabelText('Persisted state').textContent).toBe('success'));
      expect(screen.getByLabelText('Child output').textContent).toBe('{"words":9}');
    });
  });

  describe('when persistence returns a partial completed step', () => {
    it('keeps the output already received from the stream', async () => {
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: 'live-run' }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/stream`,
          () => new HttpResponse(completedChunks.map(chunk => JSON.stringify(chunk) + '\x1e').join('')),
        ),
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/live-run`, () =>
          HttpResponse.json(partialCompletedLoop),
        ),
      );
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await waitFor(() => expect(screen.getByLabelText('Stream completion').textContent).toBe('Finished'));
      await waitFor(() => expect(screen.getByLabelText('Persisted state').textContent).toBe('success'));
      expect(screen.getByLabelText('Child output').textContent).toBe('{"words":2}');
      expect(screen.getByLabelText('Step IDs').textContent).toContain('"__proto__"');
    });
  });

  describe('when a newly streamed run completes', () => {
    it('keeps its timeline after the stream closes and persisted steps arrive', async () => {
      let finishLoading = () => {};
      const loading = new Promise<void>(resolve => {
        finishLoading = resolve;
      });
      server.use(
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () =>
          HttpResponse.json({ runId: 'live-run' }),
        ),
        http.post(
          `${BASE_URL}/api/workflows/two-step-workflow/stream`,
          () => new HttpResponse(completedChunks.map(chunk => JSON.stringify(chunk) + '\x1e').join('')),
        ),
        http.get(`${BASE_URL}/api/workflows/two-step-workflow/runs/live-run`, async () => {
          await loading;
          return HttpResponse.json({
            ...completedLoop,
            runId: 'live-run',
            steps: {
              ...completedLoop.steps,
              'analyze-document[0].extract-excerpt': { status: 'success', startedAt: 100, endedAt: 120 },
            },
          });
        }),
      );
      renderProvider(
        undefined,
        <WorkflowSelectedStepProvider>
          <WorkflowTimeline />
        </WorkflowSelectedStepProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Stream run' }));
      await waitFor(() => expect(screen.getByLabelText('Stream completion').textContent).toBe('Finished'));
      expect(screen.getByLabelText('Streaming state').textContent).toBe('false');
      expect(screen.getByLabelText('Run state').textContent).toBe('success');
      const timeline = screen.getByTestId('workflow-timeline');
      fireEvent.click(screen.getByRole('button', { name: 'Expand timeline' }));
      expect(await screen.findByText('count-words')).not.toBeNull();
      expect(screen.getByTestId('workflow-timeline-bar')).not.toBeNull();
      finishLoading();
      expect(await screen.findByText('extract-excerpt')).not.toBeNull();
      expect(screen.getByTestId('workflow-timeline')).toBe(timeline);
      expect(screen.getAllByTestId('workflow-timeline-bar')).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'New run' }));
      expect(screen.queryByTestId('workflow-timeline')).toBeNull();
    });

    it('loads persisted child states without requiring route navigation', async () => {
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Finish run' }));
      await waitFor(() => expect(screen.getByLabelText('Child state').textContent).toBe('success'));
    });

    it('clears persisted child states when starting another run', async () => {
      renderProvider();
      fireEvent.click(screen.getByRole('button', { name: 'Finish run' }));
      await waitFor(() => expect(screen.getByLabelText('Child state').textContent).toBe('success'));
      fireEvent.click(screen.getByRole('button', { name: 'New run' }));
      expect(await screen.findByText('No child state')).not.toBeNull();
    });
  });
});
