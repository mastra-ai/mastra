import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CREATE_CONVERSATION_ROUTE,
  DELETE_CONVERSATION_ROUTE,
  GET_CONVERSATION_ITEMS_ROUTE,
  GET_CONVERSATION_ROUTE,
} from './conversations';
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

describe('Conversation Handlers', () => {
  let storage: InMemoryStore;
  let memory: MockMemory;
  let agent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
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
});
