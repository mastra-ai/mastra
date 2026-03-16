import { randomUUID } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import type { z } from 'zod';
import { HTTPException } from '../http-exception';
import type { responseInputMessageSchema } from '../schemas/responses';
import {
  createResponseBodySchema,
  deleteResponseSchema,
  responseIdPathParams,
  responseObjectSchema,
} from '../schemas/responses';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { getEffectiveResourceId, getEffectiveThreadId, validateThreadOwnership } from './utils';

type CreateResponseBody = z.infer<typeof createResponseBodySchema>;
type ResponseInputMessage = z.infer<typeof responseInputMessageSchema>;
type ResponseObject = z.infer<typeof responseObjectSchema>;
type DeleteResponse = z.infer<typeof deleteResponseSchema>;

type StoredResponseEntry = {
  id: string;
  agentId: string;
  threadId: string;
  resourceId: string;
  response: ResponseObject;
};

type InputMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AgentExecutionInput = Parameters<Agent['generate']>[0];

type ThreadExecutionContext = {
  threadId: string;
  resourceId: string;
};

type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} | null;

const encoder = new TextEncoder();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createResponseId() {
  return `resp_${randomUUID()}`;
}

function createMessageId() {
  return `msg_${randomUUID()}`;
}

function normalizeMessageContent(content: ResponseInputMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map(part => part.text).join('');
}

function normalizeInput(input: CreateResponseBody['input']): string | InputMessage[] {
  if (typeof input === 'string') {
    return input;
  }

  return input.map(message => ({
    role: message.role === 'developer' ? 'system' : message.role,
    content: normalizeMessageContent(message.content),
  }));
}

function getStoredResponseEntries(metadata?: Record<string, unknown>): StoredResponseEntry[] {
  if (!metadata) {
    return [];
  }

  const mastra = metadata.mastra;
  if (!isPlainObject(mastra)) {
    return [];
  }

  const responses = mastra.responses;
  if (!Array.isArray(responses)) {
    return [];
  }

  return responses.filter((value): value is StoredResponseEntry => {
    if (!isPlainObject(value) || !isPlainObject(value.response)) {
      return false;
    }

    return (
      typeof value.id === 'string' &&
      typeof value.agentId === 'string' &&
      typeof value.threadId === 'string' &&
      typeof value.resourceId === 'string'
    );
  });
}

function setStoredResponseEntries(
  metadata: Record<string, unknown> | undefined,
  entries: StoredResponseEntry[],
): Record<string, unknown> {
  const existingMetadata = metadata ?? {};
  const existingMastra = isPlainObject(existingMetadata.mastra) ? existingMetadata.mastra : {};

  return {
    ...existingMetadata,
    mastra: {
      ...existingMastra,
      responses: entries,
    },
  };
}

function toUsage(usage: UsageLike): ResponseObject['usage'] {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  };
}

function toResponseStatus(finishReason: string | undefined): ResponseObject['status'] {
  if (finishReason === 'suspended' || finishReason === 'error') {
    return 'incomplete';
  }

  return 'completed';
}

function buildResponseObject({
  responseId,
  outputMessageId,
  model,
  createdAt,
  status,
  text,
  usage,
  instructions,
  previousResponseId,
  store,
}: {
  responseId: string;
  outputMessageId: string;
  model: string;
  createdAt: number;
  status: ResponseObject['status'];
  text: string;
  usage: UsageLike;
  instructions?: string;
  previousResponseId?: string;
  store: boolean;
}): ResponseObject {
  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    model,
    status,
    output: [
      {
        id: outputMessageId,
        type: 'message',
        role: 'assistant',
        status: status === 'completed' ? 'completed' : 'incomplete',
        content: [
          {
            type: 'output_text',
            text,
          },
        ],
      },
    ],
    usage: toUsage(usage),
    instructions: instructions ?? null,
    previous_response_id: previousResponseId ?? null,
    store,
  };
}

function buildCreatedResponseObject({
  responseId,
  model,
  createdAt,
  instructions,
  previousResponseId,
  store,
}: {
  responseId: string;
  model: string;
  createdAt: number;
  instructions?: string;
  previousResponseId?: string;
  store: boolean;
}): ResponseObject {
  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    model,
    status: 'in_progress',
    output: [],
    usage: null,
    instructions: instructions ?? null,
    previous_response_id: previousResponseId ?? null,
    store,
  };
}

function jsonResponse(data: ResponseObject, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function formatSseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function getMemoryStore(mastra: Mastra | undefined): Promise<MemoryStorage | null> {
  const storage = mastra?.getStorage();
  if (!storage) {
    return null;
  }

  const memoryStore = await storage.getStore('memory');
  if (!memoryStore) {
    return null;
  }

  return memoryStore;
}

async function findStoredResponseEntry({
  mastra,
  responseId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  requestContext: RequestContext;
}): Promise<{ entry: StoredResponseEntry; thread: StorageThreadType; memoryStore: MemoryStorage } | null> {
  const memoryStore = await getMemoryStore(mastra);
  if (!memoryStore) {
    return null;
  }

  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

  const { threads } = await memoryStore.listThreads({
    perPage: false,
    filter: effectiveResourceId ? { resourceId: effectiveResourceId } : undefined,
  });

  for (const thread of threads) {
    const entry = getStoredResponseEntries(thread.metadata).find(candidate => candidate.id === responseId);
    if (!entry) {
      continue;
    }

    await validateThreadOwnership(thread, effectiveResourceId);
    return { entry, thread, memoryStore };
  }

  return null;
}

async function appendStoredResponseEntry({
  mastra,
  threadId,
  entry,
}: {
  mastra: Mastra | undefined;
  threadId: string;
  entry: StoredResponseEntry;
}): Promise<void> {
  const memoryStore = await getMemoryStore(mastra);
  if (!memoryStore) {
    return;
  }

  const thread = await memoryStore.getThreadById({ threadId });

  if (!thread) {
    throw new HTTPException(500, { message: `Thread ${threadId} was not found after storing the response` });
  }

  const existingEntries = getStoredResponseEntries(thread.metadata).filter(existing => existing.id !== entry.id);
  const updatedThread: StorageThreadType = {
    ...thread,
    metadata: setStoredResponseEntries(thread.metadata, [...existingEntries, entry]),
    updatedAt: new Date(),
  };

  await memoryStore.saveThread({ thread: updatedThread });
}

async function deleteStoredResponseEntry({
  mastra,
  responseId,
  requestContext,
}: {
  mastra: Mastra | undefined;
  responseId: string;
  requestContext: RequestContext;
}): Promise<boolean> {
  const match = await findStoredResponseEntry({ mastra, responseId, requestContext });
  if (!match) {
    return false;
  }

  const remainingEntries = getStoredResponseEntries(match.thread.metadata).filter(entry => entry.id !== responseId);
  const updatedThread: StorageThreadType = {
    ...match.thread,
    metadata: setStoredResponseEntries(match.thread.metadata, remainingEntries),
    updatedAt: new Date(),
  };

  await match.memoryStore.saveThread({ thread: updatedThread });
  return true;
}

async function resolveThreadExecutionContext({
  agent,
  mastra,
  store,
  previousResponseId,
  requestContext,
}: {
  agent: Agent;
  mastra: Mastra | undefined;
  store: boolean;
  previousResponseId?: string;
  requestContext: RequestContext;
}): Promise<ThreadExecutionContext | null> {
  if (previousResponseId) {
    const match = await findStoredResponseEntry({ mastra, responseId: previousResponseId, requestContext });
    if (!match) {
      throw new HTTPException(404, { message: `Stored response ${previousResponseId} was not found` });
    }

    return {
      threadId: match.thread.id,
      resourceId: match.thread.resourceId,
    };
  }

  const effectiveThreadId = getEffectiveThreadId(requestContext, undefined);
  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

  if (!store && !effectiveThreadId && !effectiveResourceId) {
    return null;
  }

  const memory = await agent.getMemory({ requestContext });
  if (!memory) {
    return null;
  }

  const threadId = effectiveThreadId ?? randomUUID();
  const existingThread = await memory.getThreadById({ threadId });
  if (existingThread) {
    await validateThreadOwnership(existingThread, effectiveResourceId);
    return {
      threadId: existingThread.id,
      resourceId: effectiveResourceId ?? existingThread.resourceId,
    };
  }

  const resourceId = effectiveResourceId ?? threadId;
  const createdThread = await memory.createThread({
    threadId,
    resourceId,
  });

  return {
    threadId: createdThread.id,
    resourceId: createdThread.resourceId,
  };
}

async function executeGenerate({
  agent,
  body,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  body: CreateResponseBody;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  return agent.generate(normalizeInput(body.input) as AgentExecutionInput, {
    instructions: body.instructions,
    requestContext,
    abortSignal,
    ...(threadContext
      ? {
          memory: {
            thread: threadContext.threadId,
            resource: threadContext.resourceId,
          },
        }
      : {}),
  });
}

async function executeStream({
  agent,
  body,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  body: CreateResponseBody;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  return agent.stream(normalizeInput(body.input) as AgentExecutionInput, {
    instructions: body.instructions,
    requestContext,
    abortSignal,
    ...(threadContext
      ? {
          memory: {
            thread: threadContext.threadId,
            resource: threadContext.resourceId,
          },
        }
      : {}),
  });
}

export const CREATE_RESPONSE_ROUTE = createRoute({
  method: 'POST',
  path: '/v1/responses',
  responseType: 'datastream-response',
  bodySchema: createResponseBodySchema,
  responseSchema: responseObjectSchema,
  summary: 'Create a response',
  description: 'Executes a Mastra agent through an OpenAI Responses API-compatible route',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, requestContext, abortSignal, ...body }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId: body.model });
      const responseId = createResponseId();
      const outputMessageId = createMessageId();
      const createdAt = Math.floor(Date.now() / 1000);
      const shouldStore = body.store ?? false;
      const threadContext = await resolveThreadExecutionContext({
        agent,
        mastra,
        store: shouldStore,
        previousResponseId: body.previous_response_id,
        requestContext,
      });
      const didStore = shouldStore && Boolean(threadContext);

      if (!body.stream) {
        const result = await executeGenerate({
          agent,
          body,
          requestContext,
          abortSignal,
          threadContext,
        });

        const response = buildResponseObject({
          responseId,
          outputMessageId,
          model: body.model,
          createdAt,
          status: toResponseStatus(result.finishReason),
          text: result.text ?? '',
          usage: result.totalUsage,
          instructions: body.instructions,
          previousResponseId: body.previous_response_id,
          store: didStore,
        });

        if (didStore && threadContext) {
          await appendStoredResponseEntry({
            mastra,
            threadId: threadContext.threadId,
            entry: {
              id: responseId,
              agentId: body.model,
              threadId: threadContext.threadId,
              resourceId: threadContext.resourceId,
              response,
            },
          });
        }

        return jsonResponse(response);
      }

      const streamResult = await executeStream({
        agent,
        body,
        requestContext,
        abortSignal,
        threadContext,
      });

      const createdResponse = buildCreatedResponseObject({
        responseId,
        model: body.model,
        createdAt,
        instructions: body.instructions,
        previousResponseId: body.previous_response_id,
        store: didStore,
      });

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(
            formatSseEvent('response.created', {
              type: 'response.created',
              response: createdResponse,
            }),
          );
          controller.enqueue(
            formatSseEvent('response.output_item.added', {
              type: 'response.output_item.added',
              output_index: 0,
              item: {
                id: outputMessageId,
                type: 'message',
                role: 'assistant',
                status: 'in_progress',
                content: [],
              },
            }),
          );

          let text = '';
          const reader = streamResult.fullStream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              if (value?.type === 'text-delta') {
                text += value.payload.text;
                controller.enqueue(
                  formatSseEvent('response.output_text.delta', {
                    type: 'response.output_text.delta',
                    output_index: 0,
                    content_index: 0,
                    item_id: outputMessageId,
                    delta: value.payload.text,
                  }),
                );
              }
            }

            const finalText = (await streamResult.text) || text;
            controller.enqueue(
              formatSseEvent('response.output_text.done', {
                type: 'response.output_text.done',
                output_index: 0,
                content_index: 0,
                item_id: outputMessageId,
                text: finalText,
              }),
            );

            const response = buildResponseObject({
              responseId,
              outputMessageId,
              model: body.model,
              createdAt,
              status: toResponseStatus(await streamResult.finishReason),
              text: finalText,
              usage: await streamResult.totalUsage,
              instructions: body.instructions,
              previousResponseId: body.previous_response_id,
              store: didStore,
            });

            if (didStore && threadContext) {
              await appendStoredResponseEntry({
                mastra,
                threadId: threadContext.threadId,
                entry: {
                  id: responseId,
                  agentId: body.model,
                  threadId: threadContext.threadId,
                  resourceId: threadContext.resourceId,
                  response,
                },
              });
            }

            controller.enqueue(
              formatSseEvent('response.completed', {
                type: 'response.completed',
                response,
              }),
            );
            controller.close();
          } catch (error) {
            controller.error(error);
          } finally {
            reader.releaseLock();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (error) {
      return handleError(error, 'Error creating response');
    }
  },
});

export const GET_RESPONSE_ROUTE = createRoute({
  method: 'GET',
  path: '/v1/responses/:responseId',
  responseType: 'json',
  pathParamSchema: responseIdPathParams,
  responseSchema: responseObjectSchema,
  summary: 'Retrieve a stored response',
  description: 'Returns a previously stored response object',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:read',
  handler: async ({ mastra, requestContext, responseId }) => {
    try {
      const match = await findStoredResponseEntry({ mastra, responseId, requestContext });
      if (!match) {
        throw new HTTPException(404, { message: `Stored response ${responseId} was not found` });
      }

      return match.entry.response;
    } catch (error) {
      return handleError(error, 'Error retrieving response');
    }
  },
});

export const DELETE_RESPONSE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/v1/responses/:responseId',
  responseType: 'json',
  pathParamSchema: responseIdPathParams,
  responseSchema: deleteResponseSchema,
  summary: 'Delete a stored response',
  description: 'Deletes a stored response so it can no longer be retrieved or chained',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:delete',
  handler: async ({ mastra, requestContext, responseId }) => {
    try {
      const deleted = await deleteStoredResponseEntry({ mastra, responseId, requestContext });
      if (!deleted) {
        throw new HTTPException(404, { message: `Stored response ${responseId} was not found` });
      }

      const response: DeleteResponse = {
        id: responseId,
        object: 'response',
        deleted: true,
      };

      return response;
    } catch (error) {
      return handleError(error, 'Error deleting response');
    }
  },
});
