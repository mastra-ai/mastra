import { randomUUID } from 'node:crypto';
import { MastraFGAPermissions } from '@mastra/core/auth/ee';
import { HTTPException } from '../http-exception';
import {
  conversationDeletedSchema,
  conversationIdPathParams,
  conversationItemsListSchema,
  conversationObjectSchema,
  createConversationBodySchema,
} from '../schemas/conversations';
import type { ConversationDeleted, ConversationItemsList, ConversationObject } from '../schemas/conversations';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { mapMastraMessagesToConversationItems } from './responses.adapter';
import { findConversationThreadAcrossAgents, getAgentMemoryStore } from './responses.storage';
import { getEffectiveResourceId } from './utils';

function buildConversationObject({ thread }: { thread: ConversationObject['thread'] }): ConversationObject {
  return {
    id: thread.id,
    object: 'conversation',
    thread,
  };
}

function buildConversationItemsList(items: ConversationItemsList['data']): ConversationItemsList {
  return {
    object: 'list',
    data: items,
    first_id: items[0]?.id ?? null,
    last_id: items.at(-1)?.id ?? null,
    has_more: false,
  };
}

function buildConversationDeleted(conversationId: string): ConversationDeleted {
  return {
    id: conversationId,
    object: 'conversation.deleted',
    deleted: true,
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
  requiresPermission: MastraFGAPermissions.AGENTS_CREATE,
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
      if (!(await getAgentMemoryStore({ agent, requestContext }))) {
        throw new HTTPException(400, { message: `Memory storage is not configured for agent "${agent.id}"` });
      }

      const threadId = conversation_id ?? randomUUID();
      const resourceId = getEffectiveResourceId(requestContext, resource_id) ?? threadId;
      const thread = await memory.createThread({
        threadId,
        resourceId,
        title,
        metadata,
      });

      return buildConversationObject({ thread });
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
  description: 'Returns a conversation object backed by a Mastra memory thread',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ mastra, requestContext, conversationId }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (!match) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      return buildConversationObject({ thread: match.thread });
    } catch (error) {
      return handleError(error, 'Error retrieving conversation');
    }
  },
});

export const GET_CONVERSATION_ITEMS_ROUTE = createRoute({
  method: 'GET',
  path: '/v1/conversations/:conversationId/items',
  responseType: 'json',
  pathParamSchema: conversationIdPathParams,
  responseSchema: conversationItemsListSchema,
  summary: 'List conversation items',
  description: 'Returns OpenAI-style conversation items derived from the stored thread messages',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ mastra, requestContext, conversationId }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (!match) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      const { messages } = await match.memoryStore.listMessages({
        threadId: conversationId,
        page: 0,
        perPage: 1000,
      });

      return buildConversationItemsList(mapMastraMessagesToConversationItems(messages));
    } catch (error) {
      return handleError(error, 'Error retrieving conversation');
    }
  },
});

export const DELETE_CONVERSATION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/v1/conversations/:conversationId',
  responseType: 'json',
  pathParamSchema: conversationIdPathParams,
  responseSchema: conversationDeletedSchema,
  summary: 'Delete a conversation',
  description: 'Deletes a thread-backed conversation and its stored items',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_DELETE,
  handler: async ({ mastra, requestContext, conversationId }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (!match) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      await match.memoryStore.deleteThread({ threadId: conversationId });

      return buildConversationDeleted(conversationId);
    } catch (error) {
      return handleError(error, 'Error deleting conversation');
    }
  },
});
