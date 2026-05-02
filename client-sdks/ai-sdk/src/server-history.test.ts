import type { UIMessage } from '@internal/ai-sdk-v5';
import { MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { chatRoute, handleChatStream } from './chat-route';

const emptyAgentStream = {
  fullStream: new ReadableStream({
    start(controller) {
      controller.close();
    },
  }),
};

function createMockMastra() {
  const agent = {
    stream: vi.fn().mockResolvedValue(emptyAgentStream),
    resumeStream: vi.fn().mockResolvedValue(emptyAgentStream),
  };

  const mastra = {
    getAgentById: vi.fn().mockReturnValue(agent),
    getLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
  };

  return { agent, mastra };
}

describe('server history', () => {
  it('sends only the submitted message and uses a server-controlled resource scope', async () => {
    const { agent, mastra } = createMockMastra();
    const message: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
    };

    await handleChatStream({
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server',
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
      params: {
        id: 'thread-1',
        trigger: 'submit-message',
        message,
      },
    });

    expect(agent.stream).toHaveBeenCalledWith(
      [message],
      expect.objectContaining({
        memory: {
          thread: 'thread-1',
          resource: 'resource-1',
        },
      }),
    );
  });

  it('rejects client-provided message history in server history mode', async () => {
    const { mastra } = createMockMastra();

    await expect(
      handleChatStream({
        mastra: mastra as any,
        agentId: 'test-agent',
        historySource: 'server',
        defaultOptions: {
          memory: {
            resource: 'resource-1',
          },
        } as any,
        params: {
          id: 'thread-1',
          messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        } as any,
      }),
    ).rejects.toThrow('Server-history requests cannot include "messages"');
  });

  it('sets a regenerate memory override and streams with no browser-provided history', async () => {
    const { agent, mastra } = createMockMastra();

    await handleChatStream({
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server',
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
      params: {
        id: 'thread-1',
        trigger: 'regenerate-message',
        messageId: 'assistant-1',
      },
    });

    expect(agent.stream).toHaveBeenCalledTimes(1);
    const [messages, options] = agent.stream.mock.calls[0]!;
    expect(messages).toEqual([]);
    expect(options?.requestContext).toBeInstanceOf(RequestContext);
    expect(options?.requestContext.get(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY)).toEqual({
      type: 'regenerate',
      targetMessageId: 'assistant-1',
    });
  });

  it('resumes compact server-history requests without browser-provided history', async () => {
    const { agent, mastra } = createMockMastra();

    await handleChatStream({
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server',
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
      params: {
        id: 'thread-1',
        runId: 'run-1',
        resumeData: { approved: true },
        messageId: 'assistant-1',
      },
    });

    expect(agent.resumeStream).toHaveBeenCalledWith(
      { approved: true },
      expect.objectContaining({
        runId: 'run-1',
        memory: {
          thread: 'thread-1',
          resource: 'resource-1',
        },
        requestContext: expect.any(RequestContext),
      }),
    );
    expect(agent.stream).not.toHaveBeenCalled();
  });

  it('rejects malformed server-history trigger and field combinations', async () => {
    const { mastra } = createMockMastra();
    const options = {
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server' as const,
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
    };

    await expect(
      handleChatStream({
        ...options,
        params: {
          id: 'thread-1',
          trigger: 'bad-trigger',
          message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        } as any,
      }),
    ).rejects.toThrow('Server-history trigger must be "submit-message" or "regenerate-message"');

    await expect(
      handleChatStream({
        ...options,
        params: {
          id: 'thread-1',
          trigger: 'submit-message',
          message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          messageId: 'assistant-1',
        },
      }),
    ).rejects.toThrow('Server-history submit requests cannot include messageId');

    await expect(
      handleChatStream({
        ...options,
        params: {
          id: 'thread-1',
          trigger: 'regenerate-message',
          messageId: 'assistant-1',
          message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        },
      }),
    ).rejects.toThrow('Server-history regenerate requests cannot include a message');

    await expect(
      handleChatStream({
        ...options,
        params: {
          id: 'thread-1',
          runId: 'run-1',
          resumeData: { approved: true },
          message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        },
      }),
    ).rejects.toThrow('Server-history resume requests cannot include a message');
  });

  it('rejects malformed server-history validation edge cases', async () => {
    const { mastra } = createMockMastra();
    const message: UIMessage = { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] };
    const options = {
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server' as const,
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
    };

    await expect(
      handleChatStream({
        ...options,
        params: {
          trigger: 'submit-message',
          message,
        } as any,
      }),
    ).rejects.toThrow('Server-history requests require an id');

    await expect(
      handleChatStream({
        ...options,
        params: {
          id: 'thread-1',
          resumeData: { approved: true },
        },
      }),
    ).rejects.toThrow('runId is required when resumeData is provided');

    await expect(
      handleChatStream({
        ...options,
        defaultOptions: {} as any,
        params: {
          id: 'thread-1',
          trigger: 'submit-message',
          message,
        },
      }),
    ).rejects.toThrow('Server-history requests require a server-controlled resourceId when using body.id as thread');
  });

  it('does not mutate a default requestContext with internal history overrides', async () => {
    const { agent, mastra } = createMockMastra();
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'tenant-1');

    await handleChatStream({
      mastra: mastra as any,
      agentId: 'test-agent',
      historySource: 'server',
      defaultOptions: {
        requestContext,
        memory: {
          resource: 'resource-1',
        },
      } as any,
      params: {
        id: 'thread-1',
        trigger: 'submit-message',
        message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      },
    });

    expect(requestContext.has(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY)).toBe(false);
    const [, options] = agent.stream.mock.calls[0]!;
    expect(options?.requestContext).not.toBe(requestContext);
    expect(options?.requestContext.get('tenant')).toBe('tenant-1');
    expect(options?.requestContext.get(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY)).toEqual({
      type: 'server-history',
    });
  });

  it('rejects execution options in server history mode', async () => {
    const { mastra } = createMockMastra();

    await expect(
      handleChatStream({
        mastra: mastra as any,
        agentId: 'test-agent',
        historySource: 'server',
        defaultOptions: {
          memory: {
            resource: 'resource-1',
          },
        } as any,
        params: {
          id: 'thread-1',
          message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          savePerStep: true,
        } as any,
      }),
    ).rejects.toThrow('Server-history requests cannot include "savePerStep"');
  });

  it('returns 400 from chatRoute when server history requests include messages', async () => {
    const { mastra } = createMockMastra();
    const route = chatRoute({
      path: '/chat/:agentId',
      historySource: 'server',
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
    });
    const body = {
      id: 'thread-1',
      messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    };
    const contextStore = new Map<string, any>([['mastra', mastra]]);

    const response = await (route as any).handler({
      req: {
        raw: new Request('http://localhost/chat/test-agent', { method: 'POST' }),
        json: () => Promise.resolve(body),
        param: (name: string) => (name === 'agentId' ? 'test-agent' : undefined),
        query: () => undefined,
      },
      get: (key: string) => contextStore.get(key),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Server-history requests cannot include "messages"',
    });
  });

  it('accepts chatRoute server-history requests with the server-provided abort signal', async () => {
    const { agent, mastra } = createMockMastra();
    const route = chatRoute({
      path: '/chat/:agentId',
      historySource: 'server',
      defaultOptions: {
        memory: {
          resource: 'resource-1',
        },
      } as any,
    });
    const body = {
      id: 'thread-1',
      trigger: 'submit-message',
      message: { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    };
    const contextStore = new Map<string, any>([['mastra', mastra]]);

    const response = await (route as any).handler({
      req: {
        raw: new Request('http://localhost/chat/test-agent', { method: 'POST' }),
        json: () => Promise.resolve(body),
        param: (name: string) => (name === 'agentId' ? 'test-agent' : undefined),
        query: () => undefined,
      },
      get: (key: string) => contextStore.get(key),
    });

    expect(response.status).not.toBe(400);
    expect(agent.stream).toHaveBeenCalledWith(
      [body.message],
      expect.objectContaining({
        abortSignal: expect.any(AbortSignal),
        memory: {
          thread: 'thread-1',
          resource: 'resource-1',
        },
      }),
    );
  });
});
