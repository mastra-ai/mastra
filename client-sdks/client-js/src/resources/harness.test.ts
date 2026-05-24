import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type { AttachmentRef } from './harness';
import { RemoteHarnessOperationError, RemoteHarnessUnsupportedError } from './harness';

global.fetch = vi.fn();

const clientOptions = {
  baseUrl: 'http://localhost:4111',
  headers: {
    Authorization: 'Bearer test-key',
  },
};

function makeSnapshot(overrides: Partial<any> = {}) {
  return {
    summary: {
      sessionId: 'session-1',
      harnessName: 'default',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      lifecycle: 'active',
      createdAt: 1,
      lastActivityAt: 2,
      modeId: 'ask',
      modelId: 'openai/gpt-5',
      busy: false,
      queueDepth: 0,
      pendingInbox: { count: 0, kinds: [], sessionOwnedOnly: true },
      durableWork: {
        activeCount: 0,
        waitingCount: 0,
        retryingCount: 0,
        failedCount: 0,
        sessionOwnedOnly: true,
      },
      ...overrides.summary,
    },
    state: overrides.state ?? { draft: true },
    queue: { depth: 0, queuedItemIds: [] },
    pendingInbox: [],
    durableWork: { active: [], recentTerminal: [], truncated: false, sessionOwnedOnly: true },
    channelBindings: [],
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    messages: { cursor: { threadId: 'thread-1', route: 'thread-messages' } },
    ...overrides,
  };
}

function mockJson(data: unknown, init: ResponseInit = {}) {
  (global.fetch as any).mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers: new Headers({ 'content-type': 'application/json', ...Object.fromEntries(new Headers(init.headers)) }),
    }),
  );
}

function mockSse(events: unknown[], newline = '\n') {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events as Array<{ id: string; type: string }>) {
        controller.enqueue(
          encoder.encode(
            `id: ${event.id}${newline}event: ${event.type}${newline}data: ${JSON.stringify(event)}${newline}${newline}`,
          ),
        );
      }
      controller.close();
    },
  });
  (global.fetch as any).mockResolvedValueOnce(
    new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    }),
  );
}

describe('Harness Resource', () => {
  let client: MastraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('creates a remote session through MastraClient.getHarness()', async () => {
    mockJson({ session: makeSnapshot() });

    const session = await client.getHarness().session({ threadId: { fresh: true }, modeId: 'ask' });

    expect(session.id).toBe('session-1');
    expect(session.threadId).toBe('thread-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/default/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({ threadId: { fresh: true }, modeId: 'ask' }),
      }),
    );
  });

  it('opens an existing session by GET when sessionId is the only option', async () => {
    mockJson(makeSnapshot());

    const session = await client.getHarness().session({ sessionId: 'session-1' });

    expect(session.id).toBe('session-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/default/sessions/session-1',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('does not retry non-idempotent session creation after a failed response', async () => {
    mockJson(
      { code: 'harness.create_failed', message: 'failed' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    await expect(client.getHarness().session({ threadId: { fresh: true } })).rejects.toThrow('HTTP error! status: 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry aborted requests', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeSnapshot()), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
        }),
      )
      .mockRejectedValueOnce(abortError);
    const abortingClient = new MastraClient({ ...clientOptions, fetch });

    const session = await abortingClient.getHarness().session({ sessionId: 'session-1' });
    await expect(session.refresh()).rejects.toThrow('aborted');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('settles message promises through event stream plus result lookup without readmitting work', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'complete',
        timestamp: 3,
      },
    ]);
    mockJson({ status: 'completed', source: 'message', runId: 'run-1', result: { text: 'done' } });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).resolves.toEqual({ text: 'done' });

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4111/api/harness/default/sessions/session-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'hello', admissionId: 'admission-1' }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/default/sessions/session-1/events',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('does not retry message admission after a failed response', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson(
      { code: 'harness.message_failed', message: 'failed' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toThrow(
      'HTTP error! status: 500',
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('settles queued work through queue result lookup', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, queuedItemId: 'queue-1', duplicate: false });
    mockJson({ status: 'pending', source: 'queue' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        queuedItemId: 'queue-1',
        reason: 'complete',
        timestamp: 3,
      },
    ]);
    mockJson({ status: 'completed', source: 'queue', result: { text: 'queued' } });

    const session = await client.getHarness().session();
    await expect(session.queue({ content: 'later', admissionId: 'queue-admission-1' })).resolves.toEqual({
      text: 'queued',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4111/api/harness/default/sessions/session-1/queue',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'later', admissionId: 'queue-admission-1' }),
      }),
    );
  });

  it('passes file, primitive, and element attachment refs through message and queue admissions', async () => {
    const attachments: AttachmentRef[] = [
      {
        attachmentId: 'file-attachment-1',
        resourceId: 'resource-1',
        ownerSessionId: 'session-1',
        source: 'preupload',
        kind: 'file',
        name: 'paper.pdf',
        mimeType: 'application/pdf',
        bytes: 1234,
        sha256: '0'.repeat(64),
      },
      {
        attachmentId: 'primitive-attachment-1',
        resourceId: 'resource-1',
        ownerSessionId: 'session-1',
        source: 'preupload',
        kind: 'primitive',
        primitiveType: 'table',
        schemaId: 'schema:table:v1',
        object: {
          providerId: 'cloudflare-r2',
          objectKey: 'harness/resource-1/session-1/primitives/primitive-attachment-1.json',
          etag: 'primitive-etag-1',
          storageClass: 'standard',
        },
      },
      {
        attachmentId: 'element-attachment-1',
        resourceId: 'resource-1',
        ownerSessionId: 'session-1',
        source: 'preupload',
        kind: 'element',
        elementType: 'chart',
        renderer: { type: 'vega-lite' },
        metadata: { cloudStorage: 'r2' },
      },
    ];
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ accepted: true, queuedItemId: 'queue-1', duplicate: false });

    const session = await client.getHarness().session();
    await expect(
      session.admitMessage({ content: 'summarize attachments', admissionId: 'message-admission-1', attachments }),
    ).resolves.toEqual({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    await expect(
      session.admitQueue({ content: 'process attachments later', admissionId: 'queue-admission-1', attachments }),
    ).resolves.toEqual({ accepted: true, queuedItemId: 'queue-1', duplicate: false });

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4111/api/harness/default/sessions/session-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: 'summarize attachments',
          admissionId: 'message-admission-1',
          attachments,
        }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:4111/api/harness/default/sessions/session-1/queue',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: 'process attachments later',
          admissionId: 'queue-admission-1',
          attachments,
        }),
      }),
    );
  });

  it('throws failed operation evidence as RemoteHarnessOperationError', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({
      status: 'failed',
      source: 'message',
      runId: 'run-1',
      error: { code: 'harness.message_failed', message: 'model failed' },
    });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      RemoteHarnessOperationError,
    );
  });

  it('refreshes snapshot ETag before patching state when needed', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson(makeSnapshot(), { headers: { etag: '"7"' } });
    mockJson({ draft: false }, { headers: { etag: '"8"' } });

    const session = await client.getHarness().session();
    await expect(session.setState({ draft: false })).resolves.toEqual({ draft: false });

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:4111/api/harness/default/sessions/session-1/state',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'if-match': '"7"' }),
        body: JSON.stringify({ draft: false }),
      }),
    );
  });

  it('does not retry conditional state patches after a failed response', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson(
      { code: 'harness.state_conflict', message: 'conflict' },
      { status: 409, statusText: 'Conflict', headers: { etag: '"8"' } },
    );

    const session = await client.getHarness().session();
    await expect(session.setState({ draft: false }, { ifVersion: 7 })).rejects.toThrow('HTTP error! status: 409');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry goal kickoff requests after a failed response', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ code: 'harness.goal_failed', message: 'failed' }, { status: 500, statusText: 'Internal Server Error' });

    const session = await client.getHarness().session();
    await expect(session.setGoal({ objective: 'ship it' })).rejects.toThrow('HTTP error! status: 500');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry goal replacement without kickoff after a failed response', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ code: 'harness.goal_failed', message: 'failed' }, { status: 500, statusText: 'Internal Server Error' });

    const session = await client.getHarness().session();
    await expect(session.setGoal({ objective: 'ship it', kickoff: false })).rejects.toThrow('HTTP error! status: 500');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('fetches redacted channel diagnostics for a remote session', async () => {
    const diagnostics = {
      harnessName: 'default',
      resourceId: 'resource-1',
      sessionId: 'session-1',
      visibleSessionIds: ['session-1'],
      bindings: [],
      inbox: [],
      actionTokens: [],
      actionReceipts: [],
      outbox: [],
      limit: 10,
      truncated: false,
      redacted: true,
    };
    mockJson({ session: makeSnapshot() });
    mockJson(diagnostics);

    const session = await client.getHarness().session();
    await expect(session.channelDiagnostics({ limit: 10 })).resolves.toEqual(diagnostics);
    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:4111/api/harness/default/sessions/session-1/channel-diagnostics?limit=10',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('recovers message settlement through result lookup after an event stream failure', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockJson({ code: 'harness.stream_failed', message: 'stream failed' }, { status: 500, statusText: 'Server Error' });
    mockJson({ status: 'completed', source: 'message', runId: 'run-1', result: { text: 'done after reconnect' } });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).resolves.toEqual({
      text: 'done after reconnect',
    });
  });

  it('rejects failed operation evidence after pending settlement', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'error',
        timestamp: 3,
      },
    ]);
    mockJson({
      status: 'failed',
      source: 'message',
      runId: 'run-1',
      error: { code: 'tool.failed', message: 'tool failed' },
    });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      RemoteHarnessOperationError,
    );
  });

  it('rejects expired operation evidence after pending settlement', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'error',
        timestamp: 3,
      },
    ]);
    mockJson({ status: 'expired', source: 'message', runId: 'run-1', expiredAt: 4 });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      RemoteHarnessOperationError,
    );
  });

  it('rejects missing operation evidence after pending settlement', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'error',
        timestamp: 3,
      },
    ]);
    mockJson({ status: 'not_found', source: 'message' });

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      RemoteHarnessOperationError,
    );
  });

  it('rejects aborted operation settlement instead of polling forever', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'error',
        timestamp: 3,
      },
    ]);
    (global.fetch as any).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

    const session = await new MastraClient({ ...clientOptions, retries: 0 }).getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).rejects.toThrow('aborted');
  });

  it('keeps polling after a transient result lookup failure', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:1',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'complete',
        timestamp: 3,
      },
    ]);
    mockJson(
      { code: 'harness.lookup_failed', message: 'try again' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    mockJson({ status: 'completed', source: 'message', runId: 'run-1', result: { text: 'done after retry' } });

    const session = await client.getHarness().session();
    const result = session.message({ content: 'hello', admissionId: 'admission-1' });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5));

    await expect(result).resolves.toEqual({ text: 'done after retry' });
  });

  it('does not advance the public replay cursor from internal settlement streams', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
    mockJson({ status: 'pending', source: 'message', runId: 'run-1' });
    mockSse([
      {
        id: 'harness-v1:epoch-1:7',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'complete',
        timestamp: 3,
      },
    ]);
    mockJson({ status: 'completed', source: 'message', runId: 'run-1', result: { text: 'done' } });
    mockSse([]);

    const session = await client.getHarness().session();
    await expect(session.message({ content: 'hello', admissionId: 'admission-1' })).resolves.toEqual({ text: 'done' });

    const unsubscribe = session.subscribe(() => {});
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(6));
    expect((global.fetch as any).mock.calls[5][1].headers).not.toHaveProperty('Last-Event-ID');
    unsubscribe();
  });

  it('uses Last-Event-ID as a header when reconnecting from a cursor', async () => {
    mockJson({ session: makeSnapshot() });
    mockSse([]);

    const session = await client.getHarness().session();
    const unsubscribe = session.subscribe(() => {}, { lastEventId: 'harness-v1:epoch-1:7' });
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/api/harness/default/sessions/session-1/events',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Last-Event-ID': 'harness-v1:epoch-1:7' }),
        }),
      );
    });
    unsubscribe();
  });

  it('parses CRLF-delimited event stream frames', async () => {
    mockJson({ session: makeSnapshot() });
    mockSse(
      [
        {
          id: 'harness-v1:epoch-1:7',
          type: 'agent_end',
          sessionId: 'session-1',
          signalId: 'signal-1',
          runId: 'run-1',
          reason: 'complete',
          timestamp: 3,
        },
      ],
      '\r\n',
    );
    const listener = vi.fn();

    const session = await client.getHarness().session();
    const unsubscribe = session.subscribe(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    unsubscribe();
  });

  it('keeps an explicit Last-Event-ID as the public cursor when no events arrive', async () => {
    mockJson({ session: makeSnapshot() });
    mockSse([]);

    const session = await client.getHarness().session();
    const firstUnsubscribe = session.subscribe(() => {}, { lastEventId: 'harness-v1:epoch-1:7' });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    firstUnsubscribe();

    mockSse([]);
    const secondUnsubscribe = session.subscribe(() => {});
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect((global.fetch as any).mock.calls[2][1].headers).toMatchObject({
      'Last-Event-ID': 'harness-v1:epoch-1:7',
    });
    secondUnsubscribe();
  });

  it('refreshes the snapshot and clears stale replay cursors after a 412 replay gap', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson(
      {
        code: 'harness.event_replay_unavailable',
        message: 'Harness event replay cursor cannot be served',
        details: { reason: 'stale_epoch' },
      },
      { status: 412, statusText: 'Precondition Failed' },
    );
    mockJson(makeSnapshot({ state: { refreshed: true }, summary: { lastActivityAt: 42 } }));
    mockSse([]);
    const listener = vi.fn();
    const onReplayGap = vi.fn();

    const session = await client.getHarness().session();
    const unsubscribe = session.subscribe(listener, {
      lastEventId: 'harness-v1:epoch-1:7',
      onReplayGap,
    });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));

    expect(onReplayGap).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    expect(session.getState()).toEqual({ refreshed: true });
    expect(session.lastActivityAt).toBe(42);
    expect((global.fetch as any).mock.calls[1]).toEqual([
      'http://localhost:4111/api/harness/default/sessions/session-1/events',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Last-Event-ID': 'harness-v1:epoch-1:7' }),
      }),
    ]);
    expect((global.fetch as any).mock.calls[2][0]).toBe('http://localhost:4111/api/harness/default/sessions/session-1');
    const reconnectCall = (global.fetch as any).mock.calls[3];
    expect(reconnectCall[0]).toBe('http://localhost:4111/api/harness/default/sessions/session-1/events');
    expect(reconnectCall[1].headers).not.toHaveProperty('Last-Event-ID');
    unsubscribe();

    mockSse([]);
    const secondUnsubscribe = session.subscribe(() => {});
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5));
    const nextSubscribeCall = (global.fetch as any).mock.calls[4];
    expect(nextSubscribeCall[0]).toBe('http://localhost:4111/api/harness/default/sessions/session-1/events');
    expect(nextSubscribeCall[1].headers).not.toHaveProperty('Last-Event-ID');
    secondUnsubscribe();
  });

  it('stops reconnecting on non-replay 4xx event stream failures', async () => {
    mockJson({ session: makeSnapshot() });
    mockJson({ code: 'harness.permission_denied', message: 'denied' }, { status: 403, statusText: 'Forbidden' });
    const onError = vi.fn();

    const session = await client.getHarness().session();
    session.subscribe(() => {}, { reconnect: true, onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('advances the replay cursor only after the listener succeeds', async () => {
    mockJson({ session: makeSnapshot() });
    mockSse([
      {
        id: 'harness-v1:epoch-1:7',
        type: 'agent_end',
        sessionId: 'session-1',
        signalId: 'signal-1',
        runId: 'run-1',
        reason: 'complete',
        timestamp: 3,
      },
    ]);
    const onError = vi.fn();

    const session = await client.getHarness().session();
    session.subscribe(
      () => {
        throw new Error('listener failed');
      },
      { onError },
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    mockSse([]);
    const unsubscribe = session.subscribe(() => {});
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect((global.fetch as any).mock.calls[2][1].headers).not.toHaveProperty('Last-Event-ID');
    unsubscribe();
  });

  it('aborts the event stream request on unsubscribe', async () => {
    mockJson({ session: makeSnapshot() });
    let eventSignal: AbortSignal | undefined;
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull,
    });
    (global.fetch as any).mockImplementationOnce((_url: string, init: RequestInit) => {
      eventSignal = init.signal as AbortSignal;
      return Promise.resolve(
        new Response(body, {
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/event-stream' }),
        }),
      );
    });

    const session = await client.getHarness().session();
    const unsubscribe = session.subscribe(() => {});
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/api/harness/default/sessions/session-1/events',
        expect.any(Object),
      );
    });
    await vi.waitFor(() => expect(pull).toHaveBeenCalled());
    unsubscribe();

    expect(eventSignal?.aborted).toBe(true);
  });

  it('keeps skill APIs explicit until matching server routes exist', async () => {
    mockJson({ session: makeSnapshot() });

    const session = await client.getHarness().session();
    await expect(session.useSkill()).rejects.toBeInstanceOf(RemoteHarnessUnsupportedError);
  });
});
