// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraClientProvider } from '../mastra-client-context';
import type { WorkflowStreamResult } from './types';
import { useStreamWorkflow } from './use-stream-workflow';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function streamResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const canceled = deferred<void>();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
    cancel() {
      canceled.resolve();
    },
  });
  return {
    response: new Response(body),
    canceled: canceled.promise,
    send(type: string, payload: Record<string, unknown> = {}) {
      controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type, payload })}\x1e`));
    },
    close: () => controller.close(),
    error: (error: Error) => controller.error(error),
  };
}

function renderWorkflow() {
  const streams = new Map<string, Response | Promise<Response>>();
  const creates = new Map<string, Response | Promise<Response>>();
  const requests: URL[] = [];
  const onError = vi.fn();
  const customFetch: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    const runId = url.searchParams.get('runId') ?? '';
    if (url.pathname.endsWith('/create-run')) {
      return creates.get(runId) ?? Response.json({ runId });
    }
    const response = streams.get(runId);
    if (!response) return new Response('Unknown run', { status: 404 });
    return response;
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MastraClientProvider, { baseUrl: 'http://localhost:4111', customFetch, children });
  const hook = renderHook(() => useStreamWorkflow({ debugMode: false, onError }), { wrapper });
  function invoke(operation: (typeof operations)[number], runId: string) {
    const { current } = hook.result;
    switch (operation) {
      case 'start':
        return current.streamWorkflow.mutateAsync({ workflowId: 'workflow', runId, inputData: {}, requestContext: {} });
      case 'observe':
        return current.observeWorkflowStream.mutateAsync({ workflowId: 'workflow', runId, storeRunResult: null });
      case 'resume':
        return current.resumeWorkflowStream.mutateAsync({
          workflowId: 'workflow',
          runId,
          step: 'step',
          resumeData: {},
          requestContext: {},
        });
      case 'time travel':
        return current.timeTravelWorkflowStream.mutateAsync({
          workflowId: 'workflow',
          runId,
          step: 'step',
          requestContext: {},
        });
    }
  }
  return {
    ...hook,
    invoke,
    streams,
    creates,
    requests,
    onError,
  };
}

const operations = ['start', 'observe', 'resume', 'time travel'] as const;

afterEach(cleanup);

describe('useStreamWorkflow stream ownership', () => {
  it('continues observing a paused run and preserves opaque outputs, custom IDs and metadata', async () => {
    const { result, streams } = renderWorkflow();
    const remote = streamResponse();
    streams.set('paused', remote.response);
    const snapshot: WorkflowStreamResult = { status: 'paused', input: { nested: [false, null] }, steps: {} };
    let observation!: Promise<void>;
    act(() => {
      observation = result.current.observeWorkflowStream.mutateAsync({
        workflowId: 'workflow',
        runId: 'paused',
        storeRunResult: snapshot,
      });
    });
    expect(result.current.streamResult).toEqual(snapshot);
    const output = { ['__proto__']: { untouched: true }, constructor: [0, false, null, ['nested']] };
    await act(async () => {
      remote.send('workflow-step-result', { id: '__proto__', status: 'success', output: 0 });
      remote.send('workflow-step-result', {
        id: 'constructor',
        status: 'success',
        output,
        customMetadata: { ['__proto__']: 'ordinary payload key', values: [null, false] },
      });
      remote.send('workflow-finish', { workflowStatus: 'success' });
      remote.close();
      await observation;
    });
    expect(result.current.streamResult).toMatchObject({
      status: 'success',
      input: snapshot.input,
      result: output,
      steps: {
        ['__proto__']: { status: 'success', output: 0 },
        constructor: {
          output,
          customMetadata: { ['__proto__']: 'ordinary payload key', values: [null, false] },
        },
      },
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it.each(['resume', 'time travel'] as const)(
    'retains the suspended snapshot until %s produces events',
    async operation => {
      const { result, streams, creates, requests, invoke } = renderWorkflow();
      const snapshot: WorkflowStreamResult = {
        status: 'suspended',
        input: {},
        steps: {},
        suspended: [['approval']],
        suspendPayload: { nested: [false, null] },
      };
      await act(async () => {
        await result.current.observeWorkflowStream.mutateAsync({
          workflowId: 'workflow',
          runId: 'suspended',
          storeRunResult: snapshot,
        });
      });
      expect(requests).toEqual([]);
      const pendingCreate = deferred<Response>();
      const remote = streamResponse();
      creates.set('suspended', pendingCreate.promise);
      streams.set('suspended', remote.response);
      let continuation!: Promise<void>;
      act(() => {
        continuation = invoke(operation, 'suspended');
      });
      expect(result.current.streamResult).toEqual(snapshot);
      expect(result.current.isStreaming).toBe(true);
      await act(async () => {
        pendingCreate.resolve(Response.json({ runId: 'suspended' }));
        remote.send('workflow-start');
        remote.send('workflow-step-result', { id: 'approval', status: 'success', output: 'continued' });
        remote.send('workflow-finish', { workflowStatus: 'success' });
        remote.close();
        await continuation;
      });
      expect(result.current.streamResult).toMatchObject({ status: 'success', result: 'continued' });
    },
  );

  it.each(operations)('cancels %s before its queued read or finally can affect the next operation', async operation => {
    const { result, streams, onError, invoke } = renderWorkflow();
    const obsolete = streamResponse();
    const current = streamResponse();
    streams.set('obsolete', obsolete.response);
    streams.set('current', current.response);
    let oldOperation!: Promise<void>;
    act(() => {
      oldOperation = invoke(operation, 'obsolete');
    });
    await act(async () => obsolete.send('workflow-start'));
    await waitFor(() => expect(result.current.streamResult?.status).toBe('running'));
    let newOperation!: Promise<void>;
    await act(async () => {
      obsolete.send('workflow-step-result', { id: 'stale', status: 'success', output: 'must not appear' });
      newOperation = invoke('start', 'current');
      await oldOperation;
      await obsolete.canceled;
    });
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamResult?.steps?.stale).toBeUndefined();
    await act(async () => {
      current.send('workflow-step-result', { id: 'current', status: 'success', output: false });
      current.send('workflow-finish', { workflowStatus: 'success' });
      current.close();
      await newOperation;
    });
    expect(result.current.streamResult).toMatchObject({ status: 'success', result: false });
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not open a late-created run after reset or stop its replacement', async () => {
    const { result, creates, streams, requests, invoke } = renderWorkflow();
    const lateCreate = deferred<Response>();
    const replacement = streamResponse();
    creates.set('obsolete', lateCreate.promise);
    streams.set('replacement', replacement.response);
    let oldOperation!: Promise<void>;
    let newOperation!: Promise<void>;
    act(() => {
      oldOperation = invoke('start', 'obsolete');
      result.current.closeStreamsAndReset();
      newOperation = invoke('observe', 'replacement');
    });
    await act(async () => {
      lateCreate.resolve(Response.json({ runId: 'obsolete' }));
      await oldOperation;
    });
    expect(requests.filter(url => url.searchParams.get('runId') === 'obsolete').map(url => url.pathname)).toEqual([
      '/api/workflows/workflow/create-run',
    ]);
    expect(result.current.isStreaming).toBe(true);
    await act(async () => {
      replacement.send('workflow-step-result', { id: 'replacement', status: 'success', output: 'new' });
      replacement.send('workflow-finish', { workflowStatus: 'success' });
      replacement.close();
      await newOperation;
    });
    expect(result.current.streamResult).toMatchObject({ status: 'success', result: 'new' });
  });

  it('cancels a late open response without replacing the active time-travel reader', async () => {
    const { result, streams, requests, invoke } = renderWorkflow();
    const lateOpen = deferred<Response>();
    const obsolete = streamResponse();
    const replacement = streamResponse();
    streams.set('obsolete', lateOpen.promise);
    streams.set('replacement', replacement.response);
    let oldOperation!: Promise<void>;
    act(() => {
      oldOperation = invoke('resume', 'obsolete');
    });
    await waitFor(() => expect(requests.some(url => url.pathname.endsWith('/resume-stream'))).toBe(true));
    let newOperation!: Promise<void>;
    act(() => {
      result.current.closeStreamsAndReset();
      newOperation = invoke('time travel', 'replacement');
    });
    await act(async () => {
      lateOpen.resolve(obsolete.response);
      await oldOperation;
      await obsolete.canceled;
    });
    expect(result.current.isStreaming).toBe(true);
    await act(async () => {
      replacement.send('workflow-step-result', { id: 'replacement', status: 'success', output: ['new'] });
      replacement.send('workflow-finish', { workflowStatus: 'success' });
      replacement.close();
      await newOperation;
    });
    expect(result.current.streamResult).toMatchObject({ status: 'success', result: ['new'] });
  });

  it('cancels the reader on unmount and ignores all retained mutation callbacks', async () => {
    const { result, streams, requests, unmount, onError, invoke } = renderWorkflow();
    const remote = streamResponse();
    streams.set('active', remote.response);
    let operation!: Promise<void>;
    act(() => {
      operation = invoke('start', 'active');
    });
    await act(async () => remote.send('workflow-start'));
    await waitFor(() => expect(result.current.streamResult?.status).toBe('running'));
    const requestCount = requests.length;
    unmount();
    await remote.canceled;
    await operation;
    for (const operation of operations) await invoke(operation, 'after-unmount');
    expect(requests).toHaveLength(requestCount);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not open a run whose creation completes after unmount', async () => {
    const { creates, requests, unmount, invoke } = renderWorkflow();
    const lateCreate = deferred<Response>();
    creates.set('obsolete', lateCreate.promise);
    let operation!: Promise<void>;
    act(() => {
      operation = invoke('start', 'obsolete');
    });
    unmount();
    lateCreate.resolve(Response.json({ runId: 'obsolete' }));
    await operation;
    expect(requests.map(url => url.pathname)).toEqual(['/api/workflows/workflow/create-run']);
  });

  it('reports real reader TypeErrors instead of mistaking them for disposal', async () => {
    const { result, streams, onError, invoke } = renderWorkflow();
    const remote = streamResponse();
    streams.set('active', remote.response);
    let operation!: Promise<void>;
    act(() => {
      operation = invoke('start', 'active');
    });
    await act(async () => remote.send('workflow-start'));
    await waitFor(() => expect(result.current.streamResult?.status).toBe('running'));
    const failure = new TypeError('Disconnected transport');
    await act(async () => {
      remote.error(failure);
      await operation;
    });
    expect(onError).toHaveBeenCalledWith(failure, 'Error streaming workflow');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamWorkflow.isError).toBe(false);
  });

  it('rejects opening failures while clearing the active streaming state', async () => {
    const { result, streams, onError, invoke } = renderWorkflow();
    streams.set('denied', new Response('Forbidden', { status: 403 }));
    await act(async () => {
      await expect(invoke('start', 'denied')).rejects.toThrow('403');
    });
    expect(result.current.streamWorkflow.isError).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });
});
