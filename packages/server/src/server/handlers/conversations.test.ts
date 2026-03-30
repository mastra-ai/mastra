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
});
