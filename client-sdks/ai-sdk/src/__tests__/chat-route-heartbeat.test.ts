import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatRoute } from '../chat-route';
import * as publicEntry from '../index';
import { withSseHeartbeat } from '../sse-heartbeat';
import * as uiEntry from '../ui';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createControlledResponse(init?: ResponseInit) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel,
  });

  return {
    cancel,
    controller,
    response: new Response(stream, init),
  };
}

function createRouteContext(fullStream: ReadableStream) {
  const agent = {
    stream: vi.fn().mockResolvedValue({ fullStream }),
  };
  const mastra = {
    getAgentById: vi.fn().mockReturnValue(agent),
  };
  const body = {
    messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
  };
  const request = new Request('http://localhost/chat/test-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    mastra,
    context: {
      req: {
        raw: request,
        json: () => Promise.resolve(body),
        param: (name: string) => (name === 'agentId' ? 'test-agent' : undefined),
        query: () => undefined,
      },
      get: (key: string) => (key === 'mastra' ? mastra : undefined),
    },
  };
}

async function invokeRoute(
  route: ReturnType<typeof chatRoute>,
  context: ReturnType<typeof createRouteContext>['context'],
): Promise<Response> {
  if (!('handler' in route)) throw new Error('Expected chatRoute to return a route handler');
  // The route only reads the context members supplied by createRouteContext.
  const response = await route.handler(context as never, async () => {});
  if (!(response instanceof Response)) throw new Error('Expected chatRoute handler to return a Response');
  return response;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('withSseHeartbeat', () => {
  it.each([undefined, 0, -1, Number.NEGATIVE_INFINITY])(
    'returns the original response when heartbeatMs is %s',
    heartbeatMs => {
      const response = new Response('data: value\n\n');
      expect(withSseHeartbeat(response, heartbeatMs)).toBe(response);
    },
  );

  it('returns the original response when it has no body', () => {
    const response = new Response(null);
    expect(withSseHeartbeat(response, 1_000)).toBe(response);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'rejects unsupported heartbeatMs value %s',
    heartbeatMs => {
      const response = new Response('data: value\n\n');
      expect(() => withSseHeartbeat(response, heartbeatMs)).toThrow(RangeError);
    },
  );

  it('preserves response metadata and source bytes around periodic heartbeats', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, response } = createControlledResponse({
      status: 202,
      statusText: 'Accepted',
      headers: { 'x-test': 'preserved' },
    });
    const wrapped = withSseHeartbeat(response, 1_000);
    const reader = wrapped.body!.getReader();

    expect(wrapped.status).toBe(202);
    expect(wrapped.statusText).toBe('Accepted');
    expect(wrapped.headers.get('x-test')).toBe('preserved');

    controller.enqueue(encoder.encode('data: one\n\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: one\n\n');

    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(decoder.decode((await heartbeat).value)).toBe(': heartbeat\n\n');

    controller.enqueue(encoder.encode('data: two\n\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: two\n\n');

    await reader.cancel();
  });

  it('does not reset the heartbeat deadline when source data arrives', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();

    await vi.advanceTimersByTimeAsync(500);
    controller.enqueue(encoder.encode('data: active\n\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: active\n\n');

    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(500);
    expect(decoder.decode((await heartbeat).value)).toBe(': heartbeat\n\n');

    await reader.cancel();
  });

  it('retains a pending source read across multiple heartbeats', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();

    const firstHeartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(decoder.decode((await firstHeartbeat).value)).toBe(': heartbeat\n\n');

    const secondHeartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(decoder.decode((await secondHeartbeat).value)).toBe(': heartbeat\n\n');

    controller.enqueue(encoder.encode('data: retained\n\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: retained\n\n');

    await reader.cancel();
  });

  it('waits for an SSE frame boundary before inserting an overdue heartbeat', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();

    controller.enqueue(encoder.encode('data: {"partial"'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: {"partial"');

    let settled = false;
    const frameEnd = reader.read().then(result => {
      settled = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBe(false);

    controller.enqueue(encoder.encode(':true}\n\n'));
    expect(decoder.decode((await frameEnd).value)).toBe(':true}\n\n');

    const overdueHeartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(0);
    expect(decoder.decode((await overdueHeartbeat).value)).toBe(': heartbeat\n\n');

    await reader.cancel();
  });

  it('recognizes a frame boundary completed by a one-byte newline chunk', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();

    controller.enqueue(encoder.encode('data: complete\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: complete\n');

    const boundary = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    controller.enqueue(encoder.encode('\n'));
    expect(decoder.decode((await boundary).value)).toBe('\n');

    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(0);
    expect(decoder.decode((await heartbeat).value)).toBe(': heartbeat\n\n');

    await reader.cancel();
  });

  it('clears its timer after normal completion', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const wrapped = withSseHeartbeat(response, 1_000);

    controller.close();
    await expect(wrapped.text()).resolves.toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('prioritizes source data buffered at the heartbeat deadline', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const sendSource = setTimeout(() => controller.enqueue(encoder.encode('data: ready\n\n')), 1_000);
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();
    const read = reader.read();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(decoder.decode((await read).value)).toBe('data: ready\n\n');
    clearTimeout(sendSource);
    await reader.cancel();
  });

  it('prioritizes source completion at the heartbeat deadline', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const wrapped = withSseHeartbeat(response, 1_000);
    const closeSource = setTimeout(() => controller.close(), 1_000);
    const read = wrapped.body!.getReader().read();

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(read).resolves.toEqual({ done: true, value: undefined });
    expect(vi.getTimerCount()).toBe(0);
    clearTimeout(closeSource);
  });

  it('clears its timer and propagates source errors', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();
    const error = new Error('source failed');

    const read = reader.read();
    controller.error(error);

    await expect(read).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('prioritizes source errors at the heartbeat deadline', async () => {
    vi.useFakeTimers();
    const { controller, response } = createControlledResponse();
    const error = new Error('source failed');
    const failSource = setTimeout(() => controller.error(error), 1_000);
    const read = withSseHeartbeat(response, 1_000).body!.getReader().read();
    const rejection = expect(read).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    clearTimeout(failSource);
  });

  it('cancels the source and clears its timer when the consumer disconnects', async () => {
    vi.useFakeTimers();
    const { cancel, response } = createControlledResponse();
    const reader = withSseHeartbeat(response, 1_000).body!.getReader();

    const pendingRead = reader.read();
    await reader.cancel('consumer disconnected');

    await expect(pendingRead).resolves.toEqual({ done: true, value: undefined });
    expect(cancel).toHaveBeenCalledWith('consumer disconnected');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('heartbeat public exports', () => {
  it('exposes the heartbeat helpers from the package entry point', () => {
    expect(typeof publicEntry.withSseHeartbeat).toBe('function');
    expect(typeof publicEntry.assertValidHeartbeatMs).toBe('function');
  });

  it('keeps the heartbeat helpers out of the browser-safe ui entry point', () => {
    expect('withSseHeartbeat' in uiEntry).toBe(false);
    expect('assertValidHeartbeatMs' in uiEntry).toBe(false);
  });

  it('adds heartbeats to a caller-built response through the package entry point', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { controller, response } = createControlledResponse({
      headers: { 'content-type': 'text/event-stream' },
    });
    const reader = publicEntry.withSseHeartbeat(response, 1_000).body!.getReader();

    controller.enqueue(encoder.encode('data: one\n\n'));
    expect(decoder.decode((await reader.read()).value)).toBe('data: one\n\n');

    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(decoder.decode((await heartbeat).value)).toBe(': heartbeat\n\n');

    await reader.cancel();
  });
});

describe('chatRoute heartbeat', () => {
  it('accepts the maximum supported heartbeatMs value', () => {
    expect(() => chatRoute({ path: '/chat/:agentId', heartbeatMs: 2_147_483_647 })).not.toThrow();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'throws a RangeError at route creation for unsupported heartbeatMs value %s',
    heartbeatMs => {
      expect(() => chatRoute({ path: '/chat/:agentId', heartbeatMs })).toThrow(RangeError);
    },
  );

  it.each(['v5', 'v6'] as const)('interleaves heartbeat comments with AI SDK %s events', async version => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let streamController!: ReadableStreamDefaultController;
    const fullStream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
    });
    const { context } = createRouteContext(fullStream);
    const route = chatRoute({
      path: '/chat/:agentId',
      version,
      heartbeatMs: 1_000,
    });

    const response = await invokeRoute(route, context);
    const reader = response.body!.getReader();

    streamController.enqueue({
      type: 'start',
      runId: 'run-1',
      from: 'AGENT',
      payload: { messageId: 'assistant-1' },
    });
    streamController.enqueue({
      type: 'text-start',
      runId: 'run-1',
      from: 'AGENT',
      payload: { id: 'text-1' },
    });
    const startEvent = decoder.decode((await reader.read()).value);
    const textStartEvent = decoder.decode((await reader.read()).value);
    expect(JSON.parse(startEvent.slice('data: '.length))).toMatchObject({ type: 'start' });
    expect(JSON.parse(textStartEvent.slice('data: '.length))).toEqual({ type: 'text-start', id: 'text-1' });

    const heartbeat = reader.read();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(decoder.decode((await heartbeat).value)).toBe(': heartbeat\n\n');

    await reader.cancel();
    streamController.close();
  });

  it.each(['v5', 'v6'] as const)(
    'does not emit heartbeats for AI SDK %s when heartbeatMs is omitted',
    async version => {
      vi.useFakeTimers();
      let streamController!: ReadableStreamDefaultController;
      const fullStream = new ReadableStream({
        start(controller) {
          streamController = controller;
        },
      });
      const { context } = createRouteContext(fullStream);
      const route = chatRoute({ path: '/chat/:agentId', version });

      const response = await invokeRoute(route, context);
      const reader = response.body!.getReader();
      let settled = false;
      const pendingRead = reader.read().then((result: { done: boolean; value?: Uint8Array }) => {
        settled = true;
        return result;
      });

      await vi.advanceTimersByTimeAsync(10_000);
      expect(settled).toBe(false);

      await reader.cancel();
      await expect(pendingRead).resolves.toEqual({ done: true, value: undefined });
      streamController.close();
    },
  );
});
