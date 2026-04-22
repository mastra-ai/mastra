import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE_CONVERSATION_ROUTE,
  DELETE_CONVERSATION_ROUTE,
  GET_CONVERSATION_ITEMS_ROUTE,
  GET_CONVERSATION_ROUTE,
} from './conversations';
import * as gatewayMemory from './gateway-memory-client';
import { createTestServerContext } from './test-utils';

class RootInjectedMockMemory extends MockMemory {
  constructor() {
    super();
    this._storage = undefined;
    this._hasOwnStorage = false;
  }
}

function createMastraWithDedicatedAgentMemory() {
  const rootStorage = new InMemoryStore();
  const agentStorage = new InMemoryStore();
  const memory = new MockMemory({ storage: agentStorage });
  const agent = new Agent({
    id: 'dedicated-agent',
    name: 'dedicated-agent',
    instructions: 'dedicated instructions',
    model: {} as never,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    storage: rootStorage,
    agents: {
      'dedicated-agent': agent,
    },
  });

  return {
    agent,
    mastra,
    memory,
    rootStorage,
  };
}

function createMastraWithAgentMemoryUsingRootStorage() {
  const rootStorage = new InMemoryStore();
  const memory = new RootInjectedMockMemory();
  const agent = new Agent({
    id: 'root-backed-agent',
    name: 'root-backed-agent',
    instructions: 'root-backed instructions',
    model: {} as never,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    storage: rootStorage,
    agents: {
      'root-backed-agent': agent,
    },
  });

  return {
    agent,
    mastra,
    rootStorage,
  };
}

function createGatewayMastra() {
  const agent = new Agent({
    id: 'gateway-agent',
    name: 'gateway-agent',
    instructions: 'gateway instructions',
    model: 'mastra/openai/gpt-5' as never,
  });
  const mastra = new Mastra({
    logger: false,
    agents: {
      'gateway-agent': agent,
    },
  });

  return {
    agent,
    mastra,
  };
}

describe('Conversation Handlers', () => {
  let storage: InMemoryStore;
  let memory: MockMemory;
  let agent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    vi.restoreAllMocks();
    storage = new InMemoryStore();
    memory = new MockMemory({ storage });

    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test instructions',
      model: {} as never,
      memory,
    });

    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        'test-agent': agent,
      },
    });
  });

  it('creates a conversation backed by a memory thread', async () => {
    const conversation = await CREATE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agent_id: 'test-agent',
      conversation_id: 'conv_123',
    });

    expect(conversation).toMatchObject({
      id: 'conv_123',
      object: 'conversation',
      thread: {
        id: 'conv_123',
        resourceId: 'conv_123',
      },
    });
  });

  it('lists conversation items derived from thread messages', async () => {
    const thread = await memory.createThread({
      threadId: 'conv_456',
      resourceId: 'conv_456',
    });

    await memory.saveMessages({
      messages: [
        {
          id: 'msg_1',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'user',
          type: 'text',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello conversation' }],
          },
        },
      ],
    });

    const items = await GET_CONVERSATION_ITEMS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      conversationId: thread.id,
    });

    expect(items).toMatchObject({
      object: 'list',
      data: [
        {
          id: 'msg_1',
          type: 'message',
          role: 'user',
          status: 'completed',
          content: [{ type: 'input_text', text: 'Hello conversation' }],
        },
      ],
    });
  });

  it('preserves tool items in conversation order', async () => {
    const baseTimestamp = Date.UTC(2024, 0, 1, 12, 0, 0);
    const thread = await memory.createThread({
      threadId: 'conv_tools',
      resourceId: 'conv_tools',
    });

    await memory.saveMessages({
      messages: [
        {
          id: 'msg_user',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'user',
          type: 'text',
          createdAt: new Date(baseTimestamp),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Check release status' }],
          },
        },
        {
          id: 'msg_assistant_tool',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'assistant',
          type: 'text',
          createdAt: new Date(baseTimestamp + 1_000),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_123',
                  toolName: 'release-status',
                  args: { channel: 'stable' },
                },
              },
            ],
          },
        },
        {
          id: 'msg_tool',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'tool',
          type: 'text',
          createdAt: new Date(baseTimestamp + 2_000),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_123',
                  toolName: 'release-status',
                  result: { state: 'green' },
                },
              },
            ],
          },
        },
        {
          id: 'msg_assistant_text',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'assistant',
          type: 'text',
          createdAt: new Date(baseTimestamp + 3_000),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Release is green.' }],
          },
        },
      ],
    });

    const items = await GET_CONVERSATION_ITEMS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      conversationId: thread.id,
    });

    expect(items).toMatchObject({
      object: 'list',
      data: [
        { id: 'msg_user', type: 'message', role: 'user' },
        { id: 'msg_assistant_tool:0:call', type: 'function_call', call_id: 'call_123', name: 'release-status' },
        { id: 'msg_tool:0:output', type: 'function_call_output', call_id: 'call_123' },
        { id: 'msg_assistant_text', type: 'message', role: 'assistant' },
      ],
    });
  });

  it('retrieves a conversation by thread id', async () => {
    const thread = await memory.createThread({
      threadId: 'conv_789',
      resourceId: 'conv_789',
    });

    const conversation = await GET_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      conversationId: thread.id,
    });

    expect(conversation).toMatchObject({
      id: thread.id,
      object: 'conversation',
      thread: {
        id: thread.id,
        resourceId: thread.resourceId,
      },
    });
  });

  it('deletes a conversation by thread id', async () => {
    const thread = await memory.createThread({
      threadId: 'conv_delete',
      resourceId: 'conv_delete',
    });

    const deleted = await DELETE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      conversationId: thread.id,
    });

    expect(deleted).toEqual({
      id: 'conv_delete',
      object: 'conversation.deleted',
      deleted: true,
    });

    await expect(
      GET_CONVERSATION_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        conversationId: thread.id,
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('retrieves, lists items, and deletes conversations from the agent memory store when Mastra root storage is different', async () => {
    const dedicated = createMastraWithDedicatedAgentMemory();

    const created = await CREATE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      agent_id: 'dedicated-agent',
      conversation_id: 'conv_dedicated',
    });

    await dedicated.memory.saveMessages({
      messages: [
        {
          id: 'dedicated_msg_1',
          threadId: 'conv_dedicated',
          resourceId: 'conv_dedicated',
          role: 'user',
          type: 'text',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello dedicated conversation' }],
          },
        },
      ],
    });

    const rootMemoryStore = await dedicated.rootStorage.getStore('memory');
    const rootThread = await rootMemoryStore!.getThreadById({ threadId: 'conv_dedicated' });
    expect(rootThread).toBeNull();

    const retrieved = await GET_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      conversationId: 'conv_dedicated',
    });
    expect(retrieved).toMatchObject({
      id: created.id,
      object: 'conversation',
      thread: {
        id: 'conv_dedicated',
        resourceId: 'conv_dedicated',
      },
    });

    const items = await GET_CONVERSATION_ITEMS_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      conversationId: 'conv_dedicated',
    });
    expect(items).toMatchObject({
      object: 'list',
      data: [
        {
          id: 'dedicated_msg_1',
          type: 'message',
          role: 'user',
        },
      ],
    });

    const deleted = await DELETE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      conversationId: 'conv_dedicated',
    });
    expect(deleted).toEqual({
      id: 'conv_dedicated',
      object: 'conversation.deleted',
      deleted: true,
    });

    await expect(
      GET_CONVERSATION_ROUTE.handler({
        ...createTestServerContext({ mastra: dedicated.mastra }),
        conversationId: 'conv_dedicated',
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('creates and retrieves conversations through agent memory when that memory inherits Mastra root storage', async () => {
    const rootBacked = createMastraWithAgentMemoryUsingRootStorage();

    const created = await CREATE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: rootBacked.mastra }),
      agent_id: 'root-backed-agent',
      conversation_id: 'conv_root_backed',
    });

    const rootMemoryStore = await rootBacked.rootStorage.getStore('memory');
    const rootThread = await rootMemoryStore!.getThreadById({ threadId: 'conv_root_backed' });
    expect(rootThread).toMatchObject({
      id: 'conv_root_backed',
      resourceId: 'conv_root_backed',
    });

    const retrieved = await GET_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: rootBacked.mastra }),
      conversationId: 'conv_root_backed',
    });

    expect(retrieved).toMatchObject({
      id: created.id,
      object: 'conversation',
      thread: {
        id: 'conv_root_backed',
        resourceId: 'conv_root_backed',
      },
    });
  });

  it('creates conversations through the gateway for gateway-backed agents', async () => {
    const gateway = createGatewayMastra();
    vi.spyOn(gatewayMemory, 'getGatewayClient').mockReturnValue({
      createThread: vi.fn().mockResolvedValue({
        thread: {
          id: 'conv_gateway',
          projectId: 'proj_123',
          resourceId: 'conv_gateway',
          title: 'Gateway thread',
          metadata: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      }),
    } as any);

    const conversation = await CREATE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      agent_id: 'gateway-agent',
      conversation_id: 'conv_gateway',
      title: 'Gateway thread',
    });

    expect(conversation).toMatchObject({
      id: 'conv_gateway',
      object: 'conversation',
      thread: {
        id: 'conv_gateway',
        resourceId: 'conv_gateway',
        title: 'Gateway thread',
      },
    });
  });

  it('creates and retrieves gateway-backed conversations without extra scoping params', async () => {
    const gateway = createGatewayMastra();
    const getThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'conv_gateway',
        projectId: 'proj_123',
        resourceId: 'conv_gateway',
        title: 'Gateway thread',
        metadata: null,
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
    });
    vi.spyOn(gatewayMemory, 'getGatewayClient').mockReturnValue({
      createThread: vi.fn().mockResolvedValue({
        thread: {
          id: 'conv_gateway',
          projectId: 'proj_123',
          resourceId: 'conv_gateway',
          title: null,
          metadata: null,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      }),
      getThread,
    } as any);

    const created = await CREATE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      agent_id: 'gateway-agent',
    });

    expect(created).toMatchObject({
      id: 'conv_gateway',
      object: 'conversation',
      thread: {
        id: 'conv_gateway',
        resourceId: 'conv_gateway',
      },
    });

    const retrieved = await GET_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      conversationId: 'conv_gateway',
      agent_id: 'gateway-agent',
    });

    expect(retrieved).toMatchObject({
      id: 'conv_gateway',
      object: 'conversation',
      thread: {
        id: 'conv_gateway',
        resourceId: 'conv_gateway',
      },
    });
    expect(getThread).toHaveBeenCalledWith('conv_gateway');
  });

  it('retrieves, lists items, and deletes conversations through the gateway', async () => {
    const gateway = createGatewayMastra();
    const getThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'conv_gateway',
        projectId: 'proj_123',
        resourceId: 'user_gateway',
        title: 'Gateway thread',
        metadata: null,
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
    });
    const deleteThread = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(gatewayMemory, 'getGatewayClient').mockReturnValue({
      getThread,
      listMessages: vi.fn().mockResolvedValue({
        total: 1,
        messages: [
          {
            id: 'msg_gateway',
            threadId: 'conv_gateway',
            role: 'user',
            content: 'Hello gateway conversation',
            type: 'text',
            createdAt: '2026-04-20T10:00:00.000Z',
          },
        ],
      }),
      deleteThread,
    } as any);

    const conversation = await GET_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      conversationId: 'conv_gateway',
      agent_id: 'gateway-agent',
    });

    expect(conversation).toMatchObject({
      id: 'conv_gateway',
      object: 'conversation',
      thread: {
        id: 'conv_gateway',
        resourceId: 'user_gateway',
      },
    });

    const items = await GET_CONVERSATION_ITEMS_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      conversationId: 'conv_gateway',
      agent_id: 'gateway-agent',
    });

    expect(items).toMatchObject({
      object: 'list',
      data: [
        {
          id: 'msg_gateway',
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello gateway conversation' }],
        },
      ],
    });

    const deleted = await DELETE_CONVERSATION_ROUTE.handler({
      ...createTestServerContext({ mastra: gateway.mastra }),
      conversationId: 'conv_gateway',
      agent_id: 'gateway-agent',
    });

    expect(deleteThread).toHaveBeenCalledWith('conv_gateway');
    expect(deleted).toEqual({
      id: 'conv_gateway',
      object: 'conversation.deleted',
      deleted: true,
    });
  });
});
