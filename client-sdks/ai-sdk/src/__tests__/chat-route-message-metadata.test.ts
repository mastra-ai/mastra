import { describe, expect, it, vi } from 'vitest';

import { chatRoute } from '../chat-route';

function createAgentStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: 'start',
        runId: 'test-run-id',
        payload: { id: 'test-message-id' },
      });
      controller.enqueue({
        type: 'finish',
        runId: 'test-run-id',
        payload: {
          stepResult: { reason: 'stop' },
          output: {
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        },
      });
      controller.close();
    },
  });
}

function createRouteContext() {
  const body = {
    messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
  };
  const agent = {
    stream: vi.fn().mockResolvedValue({ fullStream: createAgentStream() }),
  };
  const mastra = {
    getAgentById: vi.fn().mockReturnValue(agent),
  };
  const request = new Request('http://localhost/chat/test-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    req: {
      raw: request,
      json: () => Promise.resolve(body),
      param: (name: string) => (name === 'agentId' ? 'test-agent' : undefined),
      query: () => undefined,
    },
    get: (key: string) => (key === 'mastra' ? mastra : undefined),
  };
}

async function invokeRoute(route: ReturnType<typeof chatRoute>): Promise<Response> {
  if (!('handler' in route)) throw new Error('Expected chatRoute to return a route handler');
  const response = await route.handler(createRouteContext() as never, async () => {});
  if (!(response instanceof Response)) throw new Error('Expected chatRoute handler to return a Response');
  await response.text();
  return response;
}

describe('chatRoute messageMetadata', () => {
  it.each(['v5', 'v6'] as const)('forwards messageMetadata to the %s stream handler', async version => {
    const messageMetadata = vi.fn(({ part }: { part: { type: string } }) => ({
      responseLanguage: 'ar',
      partType: part.type,
    }));

    const route = chatRoute({
      path: '/chat/:agentId',
      version,
      messageMetadata,
    });

    await invokeRoute(route);

    expect(messageMetadata).toHaveBeenCalled();
    expect(messageMetadata.mock.calls.some(([{ part }]) => part.type === 'start')).toBe(true);
    expect(messageMetadata.mock.calls.some(([{ part }]) => part.type === 'finish')).toBe(true);
  });
});
