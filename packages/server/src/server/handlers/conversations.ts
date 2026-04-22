import { randomUUID } from 'node:crypto';
import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';
import {
  conversationDeletedSchema,
  conversationIdPathParams,
  conversationItemsListSchema,
  conversationLookupQuerySchema,
  conversationObjectSchema,
  createConversationBodySchema,
} from '../schemas/conversations';
import type { ConversationDeleted, ConversationItemsList, ConversationObject } from '../schemas/conversations';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { getGatewayClient, isGatewayAgentAsync, toLocalMessage, toLocalThread } from './gateway-memory-client';
import { mapMastraMessagesToConversationItems } from './responses.adapter';
import { findConversationThreadAcrossAgents, getAgentMemoryStore } from './responses.storage';
import { getEffectiveResourceId, validateThreadOwnership } from './utils';

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

async function findGatewayConversationThread({
  mastra,
  agentId,
  conversationId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  agentId?: string;
  conversationId: string;
  requestContext: RequestContext;
}) {
  const gwClient = getGatewayClient();
  if (!mastra || !gwClient) {
    return null;
  }

  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
  const agents = agentId
    ? [await getAgentFromSystem({ mastra, agentId })]
    : (Object.values(mastra.listAgents()) as Agent<any, any, any, any>[]);

  for (const agent of agents) {
    if (!(await isGatewayAgentAsync(agent))) {
      continue;
    }

    const result = await gwClient.getThread(conversationId);
    if (!result) {
      continue;
    }

    const thread = toLocalThread(result.thread);
    await validateThreadOwnership(thread, effectiveResourceId);
    return thread;
  }

  return null;
}

async function listGatewayConversationMessages(conversationId: string) {
  const gwClient = getGatewayClient();
  if (!gwClient) {
    return [];
  }

  const messages: MastraDBMessage[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const result = await gwClient.listMessages(conversationId, { limit, offset, order: 'asc' });
    if (!result) {
      return [];
    }

    messages.push(...result.messages.map(toLocalMessage));
    offset += result.messages.length;

    if (offset >= result.total || result.messages.length === 0) {
      break;
    }
  }

  return messages;
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
  handler: async ({ mastra, requestContext, agent_id, conversation_id, title, metadata }) => {
    try {
      if (!mastra) {
        throw new HTTPException(500, { message: 'Mastra instance is required for conversations' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId: agent_id });
      const gwClient = getGatewayClient();
      if (gwClient && (await isGatewayAgentAsync(agent))) {
        const threadId = conversation_id ?? randomUUID();
        const resourceId = getEffectiveResourceId(requestContext, undefined) ?? threadId;

        const created = await gwClient.createThread({
          id: threadId,
          resourceId,
          title,
          metadata,
        });

        return buildConversationObject({ thread: toLocalThread(created.thread) });
      }

      const memory = await agent.getMemory({ requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: `Agent "${agent.id}" does not have memory configured` });
      }
      if (!(await getAgentMemoryStore({ agent, requestContext }))) {
        throw new HTTPException(400, { message: `Memory storage is not configured for agent "${agent.id}"` });
      }

      const threadId = conversation_id ?? randomUUID();
      const resourceId = getEffectiveResourceId(requestContext, undefined) ?? threadId;
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
  queryParamSchema: conversationLookupQuerySchema,
  responseSchema: conversationObjectSchema,
  summary: 'Retrieve a conversation',
  description: 'Returns a conversation object backed by a Mastra memory thread',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:read',
  handler: async ({ mastra, requestContext, conversationId, agent_id }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (match) {
        return buildConversationObject({ thread: match.thread });
      }

      const gatewayThread = await findGatewayConversationThread({
        mastra,
        agentId: agent_id,
        conversationId,
        requestContext,
      });
      if (!gatewayThread) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      return buildConversationObject({ thread: gatewayThread });
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
  queryParamSchema: conversationLookupQuerySchema,
  responseSchema: conversationItemsListSchema,
  summary: 'List conversation items',
  description: 'Returns OpenAI-style conversation items derived from the stored thread messages',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:read',
  handler: async ({ mastra, requestContext, conversationId, agent_id }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (match) {
        const { messages } = await match.memoryStore.listMessages({
          threadId: conversationId,
          page: 0,
          perPage: 1000,
        });

        return buildConversationItemsList(mapMastraMessagesToConversationItems(messages));
      }

      const gatewayThread = await findGatewayConversationThread({
        mastra,
        agentId: agent_id,
        conversationId,
        requestContext,
      });
      if (!gatewayThread) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      const messages = await listGatewayConversationMessages(conversationId);
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
  queryParamSchema: conversationLookupQuerySchema,
  responseSchema: conversationDeletedSchema,
  summary: 'Delete a conversation',
  description: 'Deletes a thread-backed conversation and its stored items',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:delete',
  handler: async ({ mastra, requestContext, conversationId, agent_id }) => {
    try {
      const match = await findConversationThreadAcrossAgents({ mastra, conversationId, requestContext });
      if (match) {
        await match.memoryStore.deleteThread({ threadId: conversationId });
        return buildConversationDeleted(conversationId);
      }

      const gatewayThread = await findGatewayConversationThread({
        mastra,
        agentId: agent_id,
        conversationId,
        requestContext,
      });
      if (!gatewayThread) {
        throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
      }

      const gwClient = getGatewayClient();
      if (!gwClient) {
        throw new HTTPException(500, { message: 'Gateway memory client is not configured' });
      }

      await gwClient.deleteThread(conversationId);
      return buildConversationDeleted(conversationId);
    } catch (error) {
      return handleError(error, 'Error deleting conversation');
    }
  },
});
