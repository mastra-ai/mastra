import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../agent/index.js';
import { createMockModel } from '../../test-utils/llm-mock.js';
import { ModelRouterLanguageModel } from './router.js';

const { closeSpy, wsFetch } = vi.hoisted(() => {
  const closeSpy = vi.fn();
  const wsFetch = Object.assign(
    (..._args: any[]) => Promise.reject(new Error('Unexpected WebSocket fetch call in test')),
    { close: closeSpy },
  );

  return { closeSpy, wsFetch };
});

vi.mock('@ai-sdk/openai-v5', async () => {
  return {
    createOpenAI: vi.fn(),
  };
});

vi.mock('./openai-websocket-fetch.js', async () => {
  return {
    createOpenAIWebSocketFetch: vi.fn(() => wsFetch),
  };
});

const { createOpenAI } = await import('@ai-sdk/openai-v5');

describe('ModelRouter - OpenAI WebSocket transport', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    (ModelRouterLanguageModel as any).modelInstances = new Map();
    (ModelRouterLanguageModel as any).webSocketFetches = new Map();
    closeSpy.mockClear();

    vi.mocked(createOpenAI).mockImplementation(() => {
      return {
        responses: vi.fn((_modelId: string) => {
          return createMockModel({ mockText: 'Hello from OpenAI!' });
        }),
      } as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('uses WebSocket fetch when transport is websocket and closes on finish by default', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'ws' },
      },
    });

    const stream = await agent.stream('Hello', {
      providerOptions: {
        openai: {
          transport: 'websocket',
          websocket: { url: 'wss://api.openai.com/v1/responses' },
        },
      },
    });

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    const calls = vi.mocked(createOpenAI).mock.calls;
    const hasWebSocketFetch = calls.some(([args]) => typeof args.fetch === 'function');

    expect(hasWebSocketFetch).toBe(true);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close when closeOnFinish is false', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'ws' },
      },
    });

    const stream = await agent.stream('Hello', {
      providerOptions: {
        openai: {
          transport: 'websocket',
          websocket: { closeOnFinish: false },
        },
      },
    });

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    expect(closeSpy).not.toHaveBeenCalled();

    stream.transport?.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('uses HTTP fetch by default', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'fetch' },
      },
    });

    const stream = await agent.stream('Hello');

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    const calls = vi.mocked(createOpenAI).mock.calls;
    const hasWebSocketFetch = calls.some(([args]) => typeof args.fetch === 'function');

    expect(hasWebSocketFetch).toBe(false);
  });
});
