import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sockets, nextServerEvents } = vi.hoisted(() => ({
  sockets: [] as Array<{
    url: string;
    options: { headers: Record<string, string> };
    sent: Array<Record<string, unknown>>;
    close: () => void;
  }>,
  nextServerEvents: [] as Array<Record<string, unknown>>,
}));

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    readyState = MockWebSocket.OPEN;
    url: string;
    options: { headers: Record<string, string> };
    sent: Array<Record<string, unknown>> = [];

    constructor(url: string, options: { headers: Record<string, string> }) {
      super();
      this.url = url;
      this.options = options;
      sockets.push(this);
      queueMicrotask(() => this.emit('open'));
    }

    send(message: string) {
      this.sent.push(JSON.parse(message));
      const events = nextServerEvents.length > 0 ? nextServerEvents.splice(0) : [{ type: 'response.completed' }];
      queueMicrotask(() => {
        for (const event of events) {
          this.emit('message', JSON.stringify(event));
        }
      });
    }

    close() {
      this.readyState = 3;
      this.emit('close');
    }
  }

  return { default: MockWebSocket };
});

const { createOpenAIWebSocketFetch } = await import('./openai-websocket-fetch.js');

describe('createOpenAIWebSocketFetch', () => {
  beforeEach(() => {
    sockets.length = 0;
    nextServerEvents.length = 0;
  });

  it('converts Azure API key headers to bearer auth without sending OpenAI beta headers', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
      headers: { 'x-ms-client-request-id': 'request-1' },
      apiKeyAsBearer: true,
      betaHeader: false,
    });

    const response = await websocketFetch('https://test-resource.openai.azure.com/openai/v1/responses', {
      method: 'POST',
      headers: {
        'api-key': 'azure-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5-4-deployment', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0]).toMatchObject({
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
      options: {
        headers: expect.objectContaining({
          Authorization: 'Bearer azure-key',
          'x-ms-client-request-id': 'request-1',
        }),
      },
    });
    expect(sockets[0].options.headers).not.toHaveProperty('api-key');
    expect(sockets[0].options.headers).not.toHaveProperty('OpenAI-Beta');
  });

  it('strips HTTP-only Responses fields before sending response.create', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, background: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0].sent[0]).toMatchObject({
      type: 'response.create',
      model: 'gpt-5.5',
      input: 'hello',
    });
    expect(sockets[0].sent[0]).not.toHaveProperty('stream');
    expect(sockets[0].sent[0]).not.toHaveProperty('background');
  });

  it('terminates the SSE stream for failed and incomplete response events', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();
    nextServerEvents.push({ type: 'response.failed', response: { id: 'resp_failed' } });

    const failedResponse = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await expect(failedResponse.text()).resolves.toContain('data: [DONE]');

    nextServerEvents.push({ type: 'response.incomplete', response: { id: 'resp_incomplete' } });
    const incompleteResponse = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'again' }),
    });

    await expect(incompleteResponse.text()).resolves.toContain('data: [DONE]');
  });

  it('closes the socket when the service reports the WebSocket connection limit', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();
    nextServerEvents.push({
      type: 'error',
      status: 400,
      error: { code: 'websocket_connection_limit_reached' },
    });

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0].readyState).toBe(3);
  });

  it('does not silently fall back to HTTP for overlapping non-persisted continuations', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();
    nextServerEvents.push({ type: 'response.output_text.delta', delta: 'still running' });

    await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await expect(
      websocketFetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer openai-key' },
        body: JSON.stringify({
          stream: true,
          store: false,
          previous_response_id: 'resp_previous',
          model: 'gpt-5.5',
          input: 'continue',
        }),
      }),
    ).rejects.toThrow('Cannot start an overlapping WebSocket Responses continuation');

    websocketFetch.close();
  });
});
