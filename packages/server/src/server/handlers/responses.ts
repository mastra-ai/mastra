import { randomUUID } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  createResponseBodySchema,
  deleteResponseSchema,
  responseIdPathParams,
  responseObjectSchema,
} from '../schemas/responses';
import type {
  CreateResponseBody,
  DeleteResponse,
  ResponseInputMessage,
  ResponseObject,
  ResponseUsage,
} from '../schemas/responses';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { getEffectiveResourceId, getEffectiveThreadId, validateThreadOwnership } from './utils';

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
  promptTokens?: number;
  completionTokens?: number;
} | null;

type ResponseExecutionResult = {
  text?: string;
  finishReason?: string;
  totalUsage?: UsageLike | Promise<UsageLike>;
  usage?: UsageLike | Promise<UsageLike>;
};

type ResponseStreamResult = {
  fullStream: ReadableStream<unknown> | Promise<ReadableStream<unknown>>;
  text: Promise<string> | string;
  finishReason: Promise<string | undefined> | string | undefined;
  totalUsage?: Promise<UsageLike> | UsageLike;
  usage?: Promise<UsageLike> | UsageLike;
};

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

function toUsage(usage: UsageLike): ResponseUsage | null {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    input_tokens_details: {
      cached_tokens: 0,
    },
    output_tokens_details: {
      reasoning_tokens: 0,
    },
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
  completedAt,
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
  completedAt: number | null;
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
    completed_at: completedAt,
    model,
    status,
    output: [
      {
        id: outputMessageId,
        type: 'message',
        role: 'assistant',
        status: status === 'completed' ? 'completed' : 'incomplete',
        content: [createOutputTextPart(text)],
      },
    ],
    usage: toUsage(usage),
    error: null,
    incomplete_details: null,
    instructions: instructions ?? null,
    previous_response_id: previousResponseId ?? null,
    tools: [],
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
    completed_at: null,
    model,
    status: 'in_progress',
    output: [],
    usage: null,
    error: null,
    incomplete_details: null,
    instructions: instructions ?? null,
    previous_response_id: previousResponseId ?? null,
    tools: [],
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

function createOutputTextPart(text: string) {
  return {
    type: 'output_text' as const,
    text,
    annotations: [] as unknown[],
    logprobs: [] as unknown[],
  };
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
  const normalizedInput = normalizeInput(body.input) as AgentExecutionInput;
  const executionMemory =
    threadContext &&
    ({
      memory: {
        thread: threadContext.threadId,
        resource: threadContext.resourceId,
      },
    } as const);
  const commonOptions = {
    instructions: body.instructions,
    requestContext,
    abortSignal,
    ...(executionMemory ?? {}),
  };
  const model = await agent.getModel({ requestContext });

  if (model.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.generateLegacy(normalizedInput, {
        instructions: body.instructions,
        requestContext,
        abortSignal,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      })) as ResponseExecutionResult;
    }

    return (await agent.generateLegacy(normalizedInput, {
      instructions: body.instructions,
      requestContext,
      abortSignal,
    })) as ResponseExecutionResult;
  }

  return (await agent.generate(normalizedInput, commonOptions)) as ResponseExecutionResult;
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
  const normalizedInput = normalizeInput(body.input) as AgentExecutionInput;
  const executionMemory =
    threadContext &&
    ({
      memory: {
        thread: threadContext.threadId,
        resource: threadContext.resourceId,
      },
    } as const);
  const commonOptions = {
    instructions: body.instructions,
    requestContext,
    abortSignal,
    ...(executionMemory ?? {}),
  };
  const model = await agent.getModel({ requestContext });

  if (model.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.streamLegacy(normalizedInput, {
        instructions: body.instructions,
        requestContext,
        abortSignal,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      })) as ResponseStreamResult;
    }

    return (await agent.streamLegacy(normalizedInput, {
      instructions: body.instructions,
      requestContext,
      abortSignal,
    })) as ResponseStreamResult;
  }

  return (await agent.stream(normalizedInput, commonOptions)) as ResponseStreamResult;
}

async function resolveUsage(result: ResponseExecutionResult | ResponseStreamResult): Promise<UsageLike> {
  return (await (result.totalUsage ?? result.usage ?? null)) as UsageLike;
}

async function resolveFinishReason(
  result: ResponseExecutionResult | ResponseStreamResult,
): Promise<string | undefined> {
  return (await result.finishReason) ?? undefined;
}

async function resolveText(result: ResponseExecutionResult | ResponseStreamResult): Promise<string> {
  return (await result.text) ?? '';
}

function isTextDeltaChunk(value: unknown): value is { type: string; payload?: { text?: string }; textDelta?: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function extractTextDelta(value: unknown): string | null {
  if (!isTextDeltaChunk(value)) {
    return null;
  }

  if (value.type === 'text-delta' && typeof value.payload?.text === 'string') {
    return value.payload.text;
  }

  if (value.type === 'text-delta' && typeof value.textDelta === 'string') {
    return value.textDelta;
  }

  if (value.type === 'text-delta' && 'text' in value && typeof (value as { text?: string }).text === 'string') {
    return (value as { text: string }).text;
  }

  return null;
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
          completedAt: Math.floor(Date.now() / 1000),
          status: toResponseStatus(await resolveFinishReason(result)),
          text: await resolveText(result),
          usage: await resolveUsage(result),
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
          let sequenceNumber = 1;
          const enqueueEvent = (eventName: string, payload: Record<string, unknown>) => {
            controller.enqueue(
              formatSseEvent(eventName, {
                ...payload,
                sequence_number: sequenceNumber++,
              }),
            );
          };

          enqueueEvent('response.created', {
            type: 'response.created',
            response: createdResponse,
          });
          enqueueEvent('response.in_progress', {
            type: 'response.in_progress',
            response: createdResponse,
          });
          enqueueEvent('response.output_item.added', {
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              id: outputMessageId,
              type: 'message',
              role: 'assistant',
              status: 'in_progress',
              content: [],
            },
          });
          enqueueEvent('response.content_part.added', {
            type: 'response.content_part.added',
            output_index: 0,
            content_index: 0,
            item_id: outputMessageId,
            part: createOutputTextPart(''),
          });

          let text = '';
          const fullStream = await streamResult.fullStream;
          const reader = fullStream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              const delta = extractTextDelta(value);
              if (delta) {
                text += delta;
                enqueueEvent('response.output_text.delta', {
                  type: 'response.output_text.delta',
                  output_index: 0,
                  content_index: 0,
                  item_id: outputMessageId,
                  delta,
                });
              }
            }

            const finalText = (await resolveText(streamResult)) || text;
            enqueueEvent('response.output_text.done', {
              type: 'response.output_text.done',
              output_index: 0,
              content_index: 0,
              item_id: outputMessageId,
              text: finalText,
            });

            const response = buildResponseObject({
              responseId,
              outputMessageId,
              model: body.model,
              createdAt,
              completedAt: Math.floor(Date.now() / 1000),
              status: toResponseStatus(await resolveFinishReason(streamResult)),
              text: finalText,
              usage: await resolveUsage(streamResult),
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

            const completedItem = response.output[0] ?? {
              id: outputMessageId,
              type: 'message' as const,
              role: 'assistant' as const,
              status: 'completed' as const,
              content: [createOutputTextPart(finalText)],
            };

            enqueueEvent('response.content_part.done', {
              type: 'response.content_part.done',
              output_index: 0,
              content_index: 0,
              item_id: outputMessageId,
              part: createOutputTextPart(finalText),
            });
            enqueueEvent('response.output_item.done', {
              type: 'response.output_item.done',
              output_index: 0,
              item: completedItem,
            });
            enqueueEvent('response.completed', {
              type: 'response.completed',
              response,
            });
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
