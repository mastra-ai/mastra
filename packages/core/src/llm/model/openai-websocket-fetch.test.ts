import { describe, expect, it, vi, beforeEach } from 'vitest';

const { sockets, nextServerEvents } = vi.hoisted(() => ({
  sockets: [] as Array<{
    url: string;
    options: { headers: Record<string, string> };
    sent: Array<Record<string, unknown>>;
    close: () => void;
  }>,
  nextServerEvents: [] as Array<Record<string, unknown> | string>,
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
          this.emit('message', typeof event === 'string' ? event : JSON.stringify(event));
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

  it('can move API key headers to the WebSocket URL without sending OpenAI beta headers', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
      headers: { 'x-ms-client-request-id': 'request-1' },
      apiKeyQueryParam: 'api-key',
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
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses?api-key=azure-key',
      options: {
        headers: expect.objectContaining({
          'x-ms-client-request-id': 'request-1',
        }),
      },
    });
    expect(sockets[0].options.headers).not.toHaveProperty('Authorization');
    expect(sockets[0].options.headers).not.toHaveProperty('api-key');
    expect(sockets[0].options.headers).not.toHaveProperty('OpenAI-Beta');
  });

  it('keeps API key headers as headers when query auth is not configured', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://api.openai.com/v1/responses',
      betaHeader: false,
    });

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'api-key': 'openai-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0].options.headers).toMatchObject({
      'api-key': 'openai-key',
    });
    expect(sockets[0].options.headers).not.toHaveProperty('Authorization');
  });

  it('sends the OpenAI beta header by default', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://api.openai.com/v1/responses',
    });

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer openai-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0].options.headers).toMatchObject({
      Authorization: 'Bearer openai-key',
      'OpenAI-Beta': 'responses_websockets=2026-02-06',
    });
  });

  it('preserves explicit Authorization headers', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://api.openai.com/v1/responses',
      betaHeader: false,
    });

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer explicit-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.text();

    expect(sockets[0].options.headers).toMatchObject({
      Authorization: 'Bearer explicit-key',
    });
  });

  it('routes Responses URLs with query parameters through the WebSocket transport', async () => {
    const httpFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected HTTP fallback'));
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
      apiKeyQueryParam: 'api-key',
      betaHeader: false,
    });

    const response = await websocketFetch('https://test-resource.openai.azure.com/openai/v1/responses?api-version=v1', {
      method: 'POST',
      headers: {
        'api-key': 'azure-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5-4-deployment', input: 'hello' }),
    });

    await response.text();

    expect(httpFetch).not.toHaveBeenCalled();
    expect(sockets[0].sent[0]).toMatchObject({
      type: 'response.create',
      model: 'gpt-5-4-deployment',
    });
    httpFetch.mockRestore();
  });

  it('opens a new query-auth socket when the API key changes', async () => {
    const websocketFetch = createOpenAIWebSocketFetch({
      url: 'wss://test-resource.openai.azure.com/openai/v1/responses',
      apiKeyQueryParam: 'api-key',
      betaHeader: false,
    });

    const firstResponse = await websocketFetch('https://test-resource.openai.azure.com/openai/v1/responses', {
      method: 'POST',
      headers: {
        'api-key': 'first-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5-4-deployment', input: 'hello' }),
    });
    await firstResponse.text();

    const secondResponse = await websocketFetch('https://test-resource.openai.azure.com/openai/v1/responses', {
      method: 'POST',
      headers: {
        'api-key': 'second-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, model: 'gpt-5-4-deployment', input: 'again' }),
    });
    await secondResponse.text();

    expect(sockets).toHaveLength(2);
    expect(sockets[0].readyState).toBe(3);
    expect(sockets[1].url).toBe('wss://test-resource.openai.azure.com/openai/v1/responses?api-key=second-key');
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

  it('formats multiline WebSocket frames as valid SSE data lines', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();
    nextServerEvents.push(
      `{
  "type": "error",
  "status": 400,
  "error": {
    "code": "invalid_request_error"
  }
}`,
    );

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await expect(response.text()).resolves.toContain('data:   "type": "error",');
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

  it('does not silently fall back to HTTP for any overlapping continuation', async () => {
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
          store: true,
          previous_response_id: 'resp_previous',
          model: 'gpt-5.5',
          input: 'continue',
        }),
      }),
    ).rejects.toThrow('Cannot start an overlapping WebSocket Responses continuation');

    websocketFetch.close();
  });

  it('cleans up listeners and busy state when the response stream is cancelled', async () => {
    const websocketFetch = createOpenAIWebSocketFetch();
    nextServerEvents.push({ type: 'response.output_text.delta', delta: 'still running' });

    const response = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'hello' }),
    });

    await response.body?.cancel();

    const nextResponse = await websocketFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer openai-key' },
      body: JSON.stringify({ stream: true, model: 'gpt-5.5', input: 'again' }),
    });

    await expect(nextResponse.text()).resolves.toContain('data: [DONE]');
    expect(sockets[0].readyState).toBe(3);
    expect(sockets).toHaveLength(2);
  });
});
