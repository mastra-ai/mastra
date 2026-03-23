import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';
import {
  createResponseBodySchema,
  deleteResponseSchema,
  responseIdPathParams,
  responseObjectSchema,
} from '../schemas/responses';
import type { CreateResponseBody, DeleteResponse, ResponseObject } from '../schemas/responses';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import {
  buildCreatedResponseObject,
  buildResponseObject,
  buildStoredResponseObject,
  createMessageId,
  createOutputTextPart,
  extractTextDelta,
  formatSseEvent,
  normalizeInputToMessages,
  toResponseStatus,
  toResponseUsage,
} from './responses.adapter';
import {
  deleteStoredResponseMessage,
  findStoredResponseMessage,
  persistStoredResponse,
  resolveResponseMessages,
} from './responses.storage';
import type {
  ProviderMetadataLike,
  StoredResponseMatch,
  StoredResponseMetadata,
  ThreadExecutionContext,
  UsageLike,
} from './responses.storage';
import { getEffectiveResourceId, getEffectiveThreadId, validateThreadOwnership } from './utils';

type AgentExecutionInput = Parameters<Agent['generate']>[0];

type ResponseExecutionResult = {
  text?: string;
  finishReason?: string;
  totalUsage?: UsageLike | Promise<UsageLike>;
  usage?: UsageLike | Promise<UsageLike>;
  providerMetadata?: ProviderMetadataLike | Promise<ProviderMetadataLike>;
  response?: {
    id?: string;
    dbMessages?: MastraDBMessage[];
  };
};

type ResponseStreamResult = {
  fullStream: ReadableStream<unknown> | Promise<ReadableStream<unknown>>;
  text: Promise<string> | string;
  finishReason: Promise<string | undefined> | string | undefined;
  totalUsage?: Promise<UsageLike> | UsageLike;
  usage?: Promise<UsageLike> | UsageLike;
  providerMetadata?: Promise<ProviderMetadataLike> | ProviderMetadataLike;
  response?:
    | Promise<{
        id?: string;
        dbMessages?: MastraDBMessage[];
      }>
    | {
        id?: string;
        dbMessages?: MastraDBMessage[];
      };
};

type CompletedResponseState = {
  completedAt: number;
  status: ResponseObject['status'];
  text: string;
  usage: UsageLike;
  usageDetails: ResponseObject['usage'];
  providerOptions: ProviderMetadataLike;
};

function jsonResponse(data: ResponseObject, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Resolves the memory thread that should back the current response request.
 *
 * If `previous_response_id` is present, the request continues on that stored thread.
 * Otherwise, the route only creates or reuses a thread when the caller asked to store
 * the response and the resolved agent actually has memory configured.
 */
async function resolveThreadExecutionContext({
  agent,
  store,
  previousResponseMatch,
  requestContext,
}: {
  agent: Agent<any, any, any, any>;
  store: boolean;
  previousResponseMatch: StoredResponseMatch | null;
  requestContext: RequestContext;
}): Promise<ThreadExecutionContext | null> {
  if (previousResponseMatch) {
    return {
      threadId: previousResponseMatch.thread.id,
      resourceId: previousResponseMatch.thread.resourceId,
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

function createExecutionMemory(threadContext: ThreadExecutionContext | null) {
  if (!threadContext) {
    return undefined;
  }

  return {
    memory: {
      thread: threadContext.threadId,
      resource: threadContext.resourceId,
    },
  } as const;
}

/**
 * Resolves the execution agent for the request.
 *
 * When `agent_id` is present, the route uses the registered Mastra agent directly.
 * Without `agent_id`, the route creates a temporary stateless agent that only carries
 * the requested model and request-scoped instructions.
 */
async function resolveResponseAgent({
  mastra,
  model,
  agentId,
  previousResponseMatch,
  instructions,
}: {
  mastra: Mastra | undefined;
  model: string;
  agentId?: string;
  previousResponseMatch: StoredResponseMatch | null;
  instructions?: string;
}): Promise<Agent<any, any, any, any>> {
  const resolvedAgentId = agentId ?? previousResponseMatch?.metadata.agentId;

  if (resolvedAgentId) {
    if (!mastra) {
      throw new HTTPException(500, { message: 'Mastra instance is required for agent-backed responses' });
    }

    return getAgentFromSystem({ mastra, agentId: resolvedAgentId });
  }

  const config: ConstructorParameters<typeof Agent>[0] = {
    id: 'responses-route-agent',
    name: 'Responses Route Agent',
    instructions: instructions ?? '',
    model,
  };

  if (mastra) {
    config.mastra = mastra;
  }

  return new Agent(config);
}

/**
 * Executes a non-streaming Responses API request through the resolved Mastra agent.
 */
async function executeGenerate({
  agent,
  model,
  instructions,
  providerOptions,
  input,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  model: string;
  instructions: string | undefined;
  providerOptions: CreateResponseBody['providerOptions'];
  input: AgentExecutionInput;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  const executionMemory = createExecutionMemory(threadContext);
  const commonOptions = {
    instructions,
    requestContext,
    abortSignal,
    model,
    providerOptions,
    ...(executionMemory ?? {}),
  };
  const resolvedModel = await agent.getModel({ requestContext, modelConfig: model });

  if (resolvedModel.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.generateLegacy(input, {
        instructions,
        requestContext,
        abortSignal,
        model,
        providerOptions,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      } as never)) as ResponseExecutionResult;
    }

    return (await agent.generateLegacy(input, {
      instructions,
      requestContext,
      abortSignal,
      model,
      providerOptions,
    } as never)) as ResponseExecutionResult;
  }

  return (await agent.generate(input, commonOptions as never)) as ResponseExecutionResult;
}

/**
 * Executes a streaming Responses API request through the resolved Mastra agent.
 */
async function executeStream({
  agent,
  model,
  instructions,
  providerOptions,
  input,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  model: string;
  instructions: string | undefined;
  providerOptions: CreateResponseBody['providerOptions'];
  input: AgentExecutionInput;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  const executionMemory = createExecutionMemory(threadContext);
  const commonOptions = {
    instructions,
    requestContext,
    abortSignal,
    model,
    providerOptions,
    ...(executionMemory ?? {}),
  };
  const resolvedModel = await agent.getModel({ requestContext, modelConfig: model });

  if (resolvedModel.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.streamLegacy(input, {
        instructions,
        requestContext,
        abortSignal,
        model,
        providerOptions,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      } as never)) as ResponseStreamResult;
    }

    return (await agent.streamLegacy(input, {
      instructions,
      requestContext,
      abortSignal,
      model,
      providerOptions,
    } as never)) as ResponseStreamResult;
  }

  return (await agent.stream(input, commonOptions as never)) as ResponseStreamResult;
}

async function resolveUsage(result: ResponseExecutionResult | ResponseStreamResult): Promise<UsageLike> {
  return (await (result.totalUsage ?? result.usage ?? null)) as UsageLike;
}

async function resolveProviderMetadata(
  result: ResponseExecutionResult | ResponseStreamResult,
): Promise<ProviderMetadataLike> {
  return (await (result.providerMetadata ?? undefined)) as ProviderMetadataLike;
}

async function resolveFinishReason(
  result: ResponseExecutionResult | ResponseStreamResult,
): Promise<string | undefined> {
  return (await result.finishReason) ?? undefined;
}

async function resolveText(result: ResponseExecutionResult | ResponseStreamResult): Promise<string> {
  return (await result.text) ?? '';
}

/**
 * Resolves the final response state shared by streaming and non-streaming flows.
 */
async function resolveCompletedResponseState(
  result: ResponseExecutionResult | ResponseStreamResult,
  fallbackText: string,
): Promise<CompletedResponseState> {
  const usage = await resolveUsage(result);

  return {
    completedAt: Math.floor(Date.now() / 1000),
    status: toResponseStatus(await resolveFinishReason(result)),
    text: (await resolveText(result)) || fallbackText,
    usage,
    usageDetails: toResponseUsage(usage),
    providerOptions: await resolveProviderMetadata(result),
  };
}

/**
 * Stores the completed response when the request opted into memory-backed persistence.
 */
async function storeCompletedResponse({
  mastra,
  didStore,
  threadContext,
  result,
  responseId,
  metadata,
  completedState,
}: {
  mastra: Mastra | undefined;
  didStore: boolean;
  threadContext: ThreadExecutionContext | null;
  result: ResponseExecutionResult | ResponseStreamResult;
  responseId: string;
  metadata: Omit<StoredResponseMetadata, 'completedAt' | 'status' | 'usage' | 'providerOptions' | 'messageIds'>;
  completedState: CompletedResponseState;
}): Promise<void> {
  if (!didStore || !threadContext) {
    return;
  }

  const responseMessages = await resolveResponseMessages({
    result,
    responseId,
    text: completedState.text,
    threadContext,
  });

  await persistStoredResponse({
    mastra,
    responseId,
    metadata: {
      ...metadata,
      completedAt: completedState.completedAt,
      status: completedState.status,
      usage: completedState.usageDetails,
      providerOptions: completedState.providerOptions,
      messageIds: [],
    },
    threadContext,
    messages: responseMessages,
  });
}

export const CREATE_RESPONSE_ROUTE = createRoute({
  method: 'POST',
  path: '/v1/responses',
  responseType: 'datastream-response',
  bodySchema: createResponseBodySchema,
  responseSchema: responseObjectSchema,
  summary: 'Create a response',
  description: 'Creates a response through a Mastra-hosted Responses API-compatible route',
  tags: ['Responses'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, requestContext, abortSignal, ...body }) => {
    try {
      const previousResponseMatch = body.previous_response_id
        ? await findStoredResponseMessage({ mastra, responseId: body.previous_response_id, requestContext })
        : null;

      if (body.previous_response_id && !previousResponseMatch) {
        throw new HTTPException(404, { message: `Stored response ${body.previous_response_id} was not found` });
      }

      const executionInput = normalizeInputToMessages(body.input) as AgentExecutionInput;

      if (body.store && !body.agent_id && !previousResponseMatch?.metadata.agentId) {
        throw new HTTPException(400, {
          message: 'Stored responses require an agent_id with memory configured',
        });
      }

      const agent = await resolveResponseAgent({
        mastra,
        model: body.model,
        agentId: body.agent_id,
        previousResponseMatch,
        instructions: body.instructions,
      });

      const responseId = createMessageId();
      const createdAt = Math.floor(Date.now() / 1000);
      const shouldStore = body.store ?? false;
      const threadContext = await resolveThreadExecutionContext({
        agent,
        store: shouldStore,
        previousResponseMatch,
        requestContext,
      });

      if (shouldStore && !threadContext) {
        throw new HTTPException(400, {
          message: 'Stored responses require the target agent to have memory configured',
        });
      }

      const didStore = shouldStore && Boolean(threadContext);
      const responseMetadata = {
        agentId: agent.id,
        model: body.model,
        createdAt,
        instructions: body.instructions,
        previousResponseId: body.previous_response_id,
        store: didStore,
      };

      if (!body.stream) {
        const result = await executeGenerate({
          agent,
          model: body.model,
          instructions: body.instructions,
          providerOptions: body.providerOptions,
          input: executionInput,
          requestContext,
          abortSignal,
          threadContext,
        });

        const completedState = await resolveCompletedResponseState(result, '');
        const response = buildResponseObject({
          responseId,
          outputMessageId: responseId,
          model: body.model,
          createdAt,
          completedAt: completedState.completedAt,
          status: completedState.status,
          text: completedState.text,
          usage: completedState.usage,
          instructions: body.instructions,
          previousResponseId: body.previous_response_id,
          providerOptions: completedState.providerOptions,
          store: didStore,
        });

        await storeCompletedResponse({
          mastra,
          didStore,
          threadContext,
          result,
          responseId,
          metadata: responseMetadata,
          completedState,
        });

        return jsonResponse(response);
      }

      const streamResult = await executeStream({
        agent,
        model: body.model,
        instructions: body.instructions,
        providerOptions: body.providerOptions,
        input: executionInput,
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
              id: responseId,
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
            item_id: responseId,
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
                  item_id: responseId,
                  delta,
                });
              }
            }

            const completedState = await resolveCompletedResponseState(streamResult, text);
            enqueueEvent('response.output_text.done', {
              type: 'response.output_text.done',
              output_index: 0,
              content_index: 0,
              item_id: responseId,
              text: completedState.text,
            });

            const response = buildResponseObject({
              responseId,
              outputMessageId: responseId,
              model: body.model,
              createdAt,
              completedAt: completedState.completedAt,
              status: completedState.status,
              text: completedState.text,
              usage: completedState.usage,
              instructions: body.instructions,
              previousResponseId: body.previous_response_id,
              providerOptions: completedState.providerOptions,
              store: didStore,
            });

            await storeCompletedResponse({
              mastra,
              didStore,
              threadContext,
              result: streamResult,
              responseId,
              metadata: responseMetadata,
              completedState,
            });

            const completedItem = response.output[0] ?? {
              id: responseId,
              type: 'message' as const,
              role: 'assistant' as const,
              status: 'completed' as const,
              content: [createOutputTextPart(completedState.text)],
            };

            enqueueEvent('response.content_part.done', {
              type: 'response.content_part.done',
              output_index: 0,
              content_index: 0,
              item_id: responseId,
              part: createOutputTextPart(completedState.text),
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
      const match = await findStoredResponseMessage({ mastra, responseId, requestContext });
      if (!match) {
        throw new HTTPException(404, { message: `Stored response ${responseId} was not found` });
      }

      return buildStoredResponseObject(match);
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
      const deleted = await deleteStoredResponseMessage({ mastra, responseId, requestContext });
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
