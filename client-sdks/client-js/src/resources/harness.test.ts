import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import { HarnessEventStream, RemoteSession } from './harness';

global.fetch = vi.fn();

const clientOptions = {
  baseUrl: 'http://localhost:4111',
  headers: {
    Authorization: 'Bearer test-key',
  },
};

function mockJsonResponse(data: unknown) {
  const response = new Response(undefined, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  });

  response.json = () => Promise.resolve(data);
  (global.fetch as any).mockResolvedValueOnce(response);
}

function mockNoContentResponse() {
  (global.fetch as any).mockResolvedValueOnce(
    new Response(null, {
      status: 204,
      statusText: 'No Content',
    }),
  );
}

function mockSseResponse(blocks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const block of blocks) {
        controller.enqueue(encoder.encode(block));
      }
      controller.close();
    },
  });

  (global.fetch as any).mockResolvedValueOnce(
    new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'text/event-stream',
      }),
    }),
  );
}

describe('Harnesses Resource', () => {
  let client: MastraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('lists Harness sessions with pagination and request context', async () => {
    mockJsonResponse({
      items: [],
      truncated: false,
    });

    await client.harnesses.list('code harness', {
      cursor: 'page-2',
      limit: 20,
      includeClosed: true,
      requestContext: { resourceId: 'resource-1' },
    });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/harness/code%20harness/sessions?');
    expect(url).toContain('cursor=page-2');
    expect(url).toContain('limit=20');
    expect(url).toContain('includeClosed=true');
    expect(url).toContain('requestContext=');
  });

  it('creates a RemoteSession and keeps request context for later calls', async () => {
    mockJsonResponse({
      session: {
        summary: {
          sessionId: 'session-1',
        },
      },
    });
    mockJsonResponse({
      summary: {
        sessionId: 'session-1',
      },
      state: {},
      queue: { depth: 0, queuedItemIds: [] },
      pendingInbox: [],
      durableWork: { active: [], recentTerminal: [], truncated: false, sessionOwnedOnly: true },
      channelBindings: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      messages: { cursor: { threadId: 'thread-1', route: 'thread-messages' } },
    });

    const session = await client.harnesses.create('code', {
      modeId: 'build',
      requestContext: { resourceId: 'resource-1' },
    });

    expect(session).toBeInstanceOf(RemoteSession);
    await session.snapshot();

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/harness/code/sessions?requestContext='),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ modeId: 'build' }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/harness/code/sessions/session-1?requestContext='),
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('streams Harness events with Last-Event-ID replay support', async () => {
    mockSseResponse([
      ': keepalive\n\n',
      'id: harness-v1:epoch-1:2\nevent: model_changed\ndata: {"id":"harness-v1:epoch-1:2","type":"model_changed","sessionId":"session-1","timestamp":1,"modelId":"openai/gpt-5.5"}\n\n',
    ]);

    const stream = await client.harnesses.session('code', 'session-1').events({
      lastEventId: 'harness-v1:epoch-1:1',
    });
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(stream).toBeInstanceOf(HarnessEventStream);
    expect(stream.lastEventId).toBe('harness-v1:epoch-1:2');
    expect(events).toEqual([
      expect.objectContaining({
        id: 'harness-v1:epoch-1:2',
        type: 'model_changed',
        modelId: 'openai/gpt-5.5',
      }),
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/code/sessions/session-1/events',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Last-Event-ID': 'harness-v1:epoch-1:1',
        }),
      }),
    );
  });

  it('streams Harness events from CRLF-delimited SSE frames', async () => {
    mockSseResponse([
      ': keepalive\r\n\r\n',
      'id: harness-v1:epoch-1:2\r\nevent: model_changed\r\ndata: {"type":"model_changed","sessionId":"session-1","timestamp":1,"modelId":"openai/gpt-5.5"}\r\n\r\n',
      'id: harness-v1:epoch-1:3\r\nevent: state_changed\r\ndata: {"id":"harness-v1:epoch-1:3","type":"state_changed","sessionId":"session-1","timestamp":2,"patch":{"mode":"build"}}\r\n\r\n',
    ]);

    const stream = await client.harnesses.session('code', 'session-1').events();
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.map(event => event.id)).toEqual(['harness-v1:epoch-1:2', 'harness-v1:epoch-1:3']);
    expect(stream.lastEventId).toBe('harness-v1:epoch-1:3');
  });

  it('surfaces malformed Harness SSE data with event context', async () => {
    mockSseResponse(['id: harness-v1:epoch-1:2\ndata: {bad json}\n\n']);

    const stream = await client.harnesses.session('code', 'session-1').events();

    await expect(async () => {
      for await (const _event of stream) {
        // The malformed frame should fail before yielding.
      }
    }).rejects.toThrow('Failed to parse Harness SSE event harness-v1:epoch-1:2');
  });

  it('exposes reconnect result lookups without re-admitting work', async () => {
    mockJsonResponse({
      source: 'inbox-response',
      status: 'applied',
      itemId: 'question-1',
      kind: 'question',
      responseId: 'response-1',
      resumeAttemptId: 'response-1',
      runId: 'run-1',
      result: { ok: true },
    });

    const result = await client.harnesses.session('code', 'session-1').getInboxResponseResult('response-1');

    expect(result).toMatchObject({
      status: 'applied',
      responseId: 'response-1',
      resumeAttemptId: 'response-1',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/code/sessions/session-1/inbox-responses/response-1/result',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('handles raw 204 delete routes without forcing JSON parsing', async () => {
    mockNoContentResponse();

    await expect(
      client.harnesses.session('code', 'session-1').deleteAttachment('attachment-1'),
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/code/sessions/session-1/attachments/attachment-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('sends ETag preconditions when patching session state', async () => {
    mockJsonResponse({ selected: true });

    await client.harnesses.session('code', 'session-1').patchState({ selected: true }, { ifMatch: 7 });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/code/sessions/session-1/state',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'If-Match': '"7"',
        }),
        body: JSON.stringify({ selected: true }),
      }),
    );
  });

  it('preserves already quoted ETags when patching session state', async () => {
    mockJsonResponse({ selected: true });

    await client.harnesses.session('code', 'session-1').patchState({ selected: true }, { ifMatch: '"8"' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/harness/code/sessions/session-1/state',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'If-Match': '"8"',
        }),
      }),
    );
  });
});
