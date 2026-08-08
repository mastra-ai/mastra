// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamMock = vi.fn();
const observeMock = vi.fn();
const createRunMock = vi.fn(async () => ({ stream: streamMock, observe: observeMock }));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {
    getWorkflow() {
      return { createRun: createRunMock };
    }
  },
}));

const { useStreamWorkflow } = await import('./use-stream-workflow');
const { MastraClientProvider } = await import('../mastra-client-context');

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MastraClientProvider, { baseUrl: 'http://localhost:4111', children });

const streamOf = (chunks: unknown[]) =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

const stepStart = (id: string) => ({
  type: 'workflow-step-start',
  runId: 'run-1',
  payload: { id, stepCallId: `${id}-call`, startedAt: 1, status: 'running' },
});

const stepResult = (id: string) => ({
  type: 'workflow-step-result',
  runId: 'run-1',
  payload: { id, stepCallId: `${id}-call`, endedAt: 2, status: 'success', output: {} },
});

const workflowFinish = () => ({
  type: 'workflow-finish',
  runId: 'run-1',
  payload: { runId: 'run-1', workflowStatus: 'success' },
});

describe('useStreamWorkflow reconnection', () => {
  beforeEach(() => {
    streamMock.mockReset();
    observeMock.mockReset();
    createRunMock.mockClear();
  });

  it('replays from the consumed offset when the stream ends before the run finishes', async () => {
    // A long-running step keeps the connection idle until an intermediary closes it, so the
    // stream ends mid-run with no terminal chunk.
    streamMock.mockResolvedValue(streamOf([stepStart('step-1')]));
    observeMock.mockResolvedValue(streamOf([stepResult('step-1'), stepStart('step-2'), workflowFinish()]));

    const { result } = renderHook(() => useStreamWorkflow({}), { wrapper });

    await act(async () => {
      await result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
    });

    expect(observeMock).toHaveBeenCalledWith({ offset: 1 });

    await waitFor(() => {
      expect(result.current.streamResult.status).toBe('success');
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it('does not reconnect when the stream completes', async () => {
    streamMock.mockResolvedValue(streamOf([stepStart('step-1'), stepResult('step-1'), workflowFinish()]));

    const { result } = renderHook(() => useStreamWorkflow({}), { wrapper });

    await act(async () => {
      await result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
    });

    expect(observeMock).not.toHaveBeenCalled();
    expect(result.current.streamResult.status).toBe('success');
  });

  it('recovers when the stream errors mid-run, as a dropped fetch stream does', async () => {
    let delivered = false;
    streamMock.mockResolvedValue(
      new ReadableStream({
        pull(controller) {
          if (!delivered) {
            delivered = true;
            controller.enqueue(stepStart('step-1'));
            return;
          }
          controller.error(new TypeError('network error'));
        },
      }),
    );
    observeMock.mockResolvedValue(streamOf([stepResult('step-1'), workflowFinish()]));

    const { result } = renderHook(() => useStreamWorkflow({}), { wrapper });

    await act(async () => {
      await result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
    });

    expect(observeMock).toHaveBeenCalledWith({ offset: 1 });
    expect(result.current.streamResult.status).toBe('success');
  });

  it('does not reconnect a canceled run', async () => {
    streamMock.mockResolvedValue(
      streamOf([stepStart('step-1'), { type: 'workflow-canceled', runId: 'run-1', payload: { runId: 'run-1' } }]),
    );

    const { result } = renderHook(() => useStreamWorkflow({}), { wrapper });

    await act(async () => {
      await result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
    });

    expect(observeMock).not.toHaveBeenCalled();
    expect(result.current.streamResult.status).toBe('canceled');
  });

  it('does not reconnect a stream that was closed and reset', async () => {
    vi.useFakeTimers();
    streamMock.mockResolvedValue(streamOf([stepStart('step-1')]));
    observeMock.mockResolvedValue(streamOf([workflowFinish()]));

    const { result } = renderHook(() => useStreamWorkflow({}), { wrapper });

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
      await vi.advanceTimersByTimeAsync(0);
      result.current.closeStreamsAndReset();
      await vi.advanceTimersByTimeAsync(60_000);
      await pending;
    });

    expect(observeMock).not.toHaveBeenCalled();
    expect(result.current.streamResult.status).toBeUndefined();
    vi.useRealTimers();
  });

  it('reports an error once reconnection attempts are exhausted', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    streamMock.mockResolvedValue(streamOf([stepStart('step-1')]));
    observeMock.mockRejectedValue(new Error('observe unavailable'));

    const { result } = renderHook(() => useStreamWorkflow({ onError }), { wrapper });

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.streamWorkflow.mutateAsync({
        workflowId: 'wf',
        runId: 'run-1',
        inputData: {},
        requestContext: {},
      });
      await vi.advanceTimersByTimeAsync(60_000);
      await pending;
    });

    expect(observeMock).toHaveBeenCalledTimes(5);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Workflow stream ended before the run completed',
        cause: expect.objectContaining({ message: 'observe unavailable' }),
      }),
      expect.any(String),
    );
    expect(result.current.isStreaming).toBe(false);
    vi.useRealTimers();
  });
});
