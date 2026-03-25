import { randomUUID } from 'node:crypto';
import { HTTPException } from '../http-exception';
import {
  conversationIdPathParams,
  conversationObjectSchema,
  createConversationBodySchema,
} from '../schemas/conversations';
import type { ConversationObject } from '../schemas/conversations';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { getMemoryStore } from './responses.storage';
import { getEffectiveResourceId } from './utils';

function buildConversationObject({
  thread,
  messages,
}: {
  thread: ConversationObject['thread'];
  messages: ConversationObject['messages'];
}): ConversationObject {
  return {
    id: thread.id,
    object: 'conversation',
    thread,
    messages,
  };
}

export const CREATE_CONVERSATION_ROUTE = createRoute({
  method: 'POST',
  path: '/v1/conversations',
  responseType: 'json',
  bodySchema: createConversationBodySchema,
  responseSchema: conversationObjectSchema,
  summary: 'Create a conversation',
  description: 'Creates a new thread-backed conversation for agent-backed Responses API requests',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:create',
  handler: async ({ mastra, requestContext, agent_id, conversation_id, resource_id, title, metadata }) => {
    try {
      if (!mastra) {
        throw new HTTPException(500, { message: 'Mastra instance is required for conversations' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId: agent_id });
      const memory = await agent.getMemory({ requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: `Agent "${agent.id}" does not have memory configured` });
      }

      const threadId = conversation_id ?? randomUUID();
      const resourceId = getEffectiveResourceId(requestContext, resource_id) ?? threadId;
      const thread = await memory.createThread({
        threadId,
        resourceId,
        title,
        metadata,
      });

      return buildConversationObject({ thread, messages: [] });
    } catch (error) {
      return handleError(error, 'Error creating conversation');
    }
  },
});

export const GET_CONVERSATION_ROUTE = createRoute({
  method: 'GET',
  path: '/v1/conversations/:conversationId',
  responseType: 'json',
  pathParamSchema: conversationIdPathParams,
  responseSchema: conversationObjectSchema,
  summary: 'Retrieve a conversation',
  description: 'Returns a thread-backed conversation and the messages stored in that thread',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:read',
  handler: async ({ mastra, requestContext, conversationId }) => {
    try {
      const memoryStore = await getMemoryStore(mastra);
      if (!memoryStore) {
        throw new HTTPException(500, { message: 'Memory storage is not available' });
      }

      const thread = await memoryStore.getThreadById({ threadId: conversationId });
      if (!thread) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
      if (effectiveResourceId && thread.resourceId !== effectiveResourceId) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      const { messages } = await memoryStore.listMessages({
        threadId: conversationId,
        page: 0,
        perPage: 1000,
      });

      return buildConversationObject({ thread, messages });
    } catch (error) {
      return handleError(error, 'Error retrieving conversation');
    }
  },
});
