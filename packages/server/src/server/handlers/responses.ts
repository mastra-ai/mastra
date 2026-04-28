import { randomUUID } from 'node:crypto';
import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import { MastraFGAPermissions } from '@mastra/core/auth/ee';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
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
  buildCompletedResponse,
  buildInProgressResponse,
  createMessageId,
  createOutputTextPart,
  extractTextDelta,
  formatSseEvent,
  mapMastraToolsToResponseTools,
  mapResponseInputToExecutionMessages,
  mapResponseTurnRecordToResponse,
  toResponseStatus,
  toResponseUsage,
} from './responses.adapter';
import {
  deleteResponseTurnRecord,
  findResponseTurnRecord,
  findResponseTurnRecordAcrossAgents,
  getAgentMemoryStore,
  persistResponseTurnRecord,
  resolveResponseTurnMessagesForStorage,
} from './responses.storage';
import type {
  ProviderMetadataLike,
  ResponseTurnRecord,
  ResponseTurnRecordMetadata,
  ThreadExecutionContext,
  UsageLike,
} from './responses.storage';
import { enforceThreadAccess, getEffectiveResourceId, getEffectiveThreadId } from './utils';

type AgentExecutionInput = Parameters<Agent['generate']>[0];
type ResolvedAgentModel = Awaited<ReturnType<Agent['getModel']>>;

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

type FinalizedResponse = {
  completedState: CompletedResponseState;
  response: ResponseObject;
  responseMessages: MastraDBMessage[];
};

type PreparedCreateResponseRequest = {
  agent: Agent<any, any, any, any>;
  agentMemoryStore: MemoryStorage | null;
  configuredTools: ReturnType<typeof mapMastraToolsToResponseTools>;
  createdAt: number;
  didStore: boolean;
  executionInput: AgentExecutionInput;
  previousResponseTurnRecord: ResponseTurnRecord | null;
  resolvedModel: ResolvedAgentModel;
  responseId: string;
  responseModel: string;
  responseMetadata: Omit<
    ResponseTurnRecordMetadata,
    'completedAt' | 'status' | 'usage' | 'providerOptions' | 'messageIds'
  >;
  threadContext: ThreadExecutionContext | null;
};

const JSON_OBJECT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
} as const;

function jsonResponse(data: ResponseObject, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createStructuredOutput(text: CreateResponseBody['text']) {
  if (!text) {
    return undefined;
  }

  switch (text.format.type) {
    case 'json_object':
      return {
        schema: JSON_OBJECT_RESPONSE_SCHEMA,
        jsonPromptInjection: true,
      };
    case 'json_schema':
      return {
        schema: text.format.schema,
      };
    default:
      return undefined;
  }
}

function getStreamedMessageOutputItem(response: ResponseObject, responseId: string) {
  return (
    response.output.find(
      (item): item is Extract<ResponseObject['output'][number], { type: 'message' }> =>
        item.type === 'message' && item.id === responseId,
    ) ??
    response.output.find(
      (item): item is Extract<ResponseObject['output'][number], { type: 'message' }> => item.type === 'message',
    ) ??
    null
  );
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
  conversationId,
  previousResponseTurnRecord,
  requestContext,
}: {
  agent: Agent<any, any, any, any>;
  store: boolean;
  conversationId?: string;
  previousResponseTurnRecord: ResponseTurnRecord | null;
  requestContext: RequestContext;
}): Promise<ThreadExecutionContext | null> {
  if (conversationId && previousResponseTurnRecord && previousResponseTurnRecord.thread.id !== conversationId) {
    throw new HTTPException(400, {
      message:
        'conversation_id and previous_response_id must reference the same conversation thread when both are provided',
    });
  }

  if (previousResponseTurnRecord) {
    return {
      threadId: previousResponseTurnRecord.thread.id,
      resourceId: previousResponseTurnRecord.thread.resourceId,
    };
  }

  const effectiveThreadId = getEffectiveThreadId(requestContext, undefined);
  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

  if (!store && !conversationId && !effectiveThreadId) {
    return null;
  }

  const memory = await agent.getMemory({ requestContext });
  if (!memory) {
    if (conversationId) {
      throw new HTTPException(400, {
        message: 'conversation_id requires the target agent to have memory configured',
      });
    }

    return null;
  }

  if (conversationId) {
    const existingThread = await memory.getThreadById({ threadId: conversationId });
    if (!existingThread) {
      throw new HTTPException(404, { message: `Conversation ${conversationId} was not found` });
    }

    await enforceThreadAccess({
      mastra: agent.getMastraInstance(),
      requestContext,
      threadId: conversationId,
      thread: existingThread,
      effectiveResourceId,
    });
    return {
      threadId: existingThread.id,
      resourceId: effectiveResourceId ?? existingThread.resourceId,
    };
  }

  if (!effectiveThreadId) {
    if (!store) {
      return null;
    }

    const threadId = randomUUID();
    const createdThread = await memory.createThread({
      threadId,
      resourceId: effectiveResourceId ?? threadId,
    });

    return {
      threadId: createdThread.id,
      resourceId: createdThread.resourceId,
    };
  }

  const threadId = effectiveThreadId;
  const existingThread = await memory.getThreadById({ threadId });
  if (existingThread) {
    await enforceThreadAccess({
      mastra: agent.getMastraInstance(),
      requestContext,
      threadId,
      thread: existingThread,
      effectiveResourceId,
    });
    return {
      threadId: existingThread.id,
      resourceId: effectiveResourceId ?? existingThread.resourceId,
    };
  }

  if (!store) {
    return null;
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
 * Resolves the registered Mastra agent that owns the response request.
 */
async function resolveResponseAgent({
  mastra,
  agentId,
}: {
  mastra: Mastra | undefined;
  agentId?: string;
}): Promise<Agent<any, any, any, any>> {
  if (!agentId) {
    throw new HTTPException(400, {
      message: 'Responses requests require an agent_id',
    });
  }

  if (!mastra) {
    throw new HTTPException(500, { message: 'Mastra instance is required for agent-backed responses' });
  }

  return getAgentFromSystem({ mastra, agentId });
}

async function resolveAgentMemoryStore({
  agent,
  requestContext,
  errorMessage,
}: {
  agent: Agent<any, any, any, any>;
  requestContext: RequestContext;
  errorMessage: string;
}): Promise<MemoryStorage> {
  const agentMemoryStore = await getAgentMemoryStore({ agent, requestContext });
  if (!agentMemoryStore) {
    throw new HTTPException(400, { message: errorMessage });
  }

  return agentMemoryStore;
}

/**
 * Executes a non-streaming Responses API request through the resolved Mastra agent.
 */
async function executeGenerate({
  agent,
  resolvedModel,
  modelOverride,
  instructions,
  text,
  providerOptions,
  input,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  resolvedModel: ResolvedAgentModel;
  modelOverride?: string;
  instructions: string | undefined;
  text: CreateResponseBody['text'];
  providerOptions: CreateResponseBody['providerOptions'];
  input: AgentExecutionInput;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  const executionMemory = createExecutionMemory(threadContext);
  const structuredOutput = createStructuredOutput(text);
  const modelOption = modelOverride ? { model: modelOverride } : {};
  const commonOptions = {
    instructions,
    requestContext,
    abortSignal,
    ...modelOption,
    structuredOutput,
    providerOptions,
    ...(executionMemory ?? {}),
  };

  if (resolvedModel.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.generateLegacy(input, {
        instructions,
        requestContext,
        abortSignal,
        ...modelOption,
        output: structuredOutput?.schema,
        providerOptions,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      } as never)) as ResponseExecutionResult;
    }

    return (await agent.generateLegacy(input, {
      instructions,
      requestContext,
      abortSignal,
      ...modelOption,
      output: structuredOutput?.schema,
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
  resolvedModel,
  modelOverride,
  instructions,
  text,
  providerOptions,
  input,
  requestContext,
  abortSignal,
  threadContext,
}: {
  agent: Agent;
  resolvedModel: ResolvedAgentModel;
  modelOverride?: string;
  instructions: string | undefined;
  text: CreateResponseBody['text'];
  providerOptions: CreateResponseBody['providerOptions'];
  input: AgentExecutionInput;
  requestContext: RequestContext;
  abortSignal: AbortSignal;
  threadContext: ThreadExecutionContext | null;
}) {
  const executionMemory = createExecutionMemory(threadContext);
  const structuredOutput = createStructuredOutput(text);
  const modelOption = modelOverride ? { model: modelOverride } : {};
  const commonOptions = {
    instructions,
    requestContext,
    abortSignal,
    ...modelOption,
    structuredOutput,
    providerOptions,
    ...(executionMemory ?? {}),
  };

  if (resolvedModel.specificationVersion === 'v1') {
    if (threadContext) {
      return (await agent.streamLegacy(input, {
        instructions,
        requestContext,
        abortSignal,
        ...modelOption,
        output: structuredOutput?.schema,
        providerOptions,
        resourceId: threadContext.resourceId,
        threadId: threadContext.threadId,
      } as never)) as ResponseStreamResult;
    }

    return (await agent.streamLegacy(input, {
      instructions,
      requestContext,
      abortSignal,
      ...modelOption,
      output: structuredOutput?.schema,
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
  agentMemoryStore,
  didStore,
  threadContext,
  responseId,
  metadata,
  completedState,
  messages,
}: {
  agentMemoryStore: MemoryStorage | null;
  didStore: boolean;
  threadContext: ThreadExecutionContext | null;
  responseId: string;
  metadata: Omit<ResponseTurnRecordMetadata, 'completedAt' | 'status' | 'usage' | 'providerOptions' | 'messageIds'>;
  completedState: CompletedResponseState;
  messages: MastraDBMessage[];
}): Promise<void> {
  if (!didStore || !threadContext) {
    return;
  }

  await persistResponseTurnRecord({
    memoryStore: agentMemoryStore,
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
    messages,
  });
}

/**
 * Resolves the final response object and persists the stored response turn when needed.
 */
async function finalizeResponse({
  agentMemoryStore,
  didStore,
  threadContext,
  result,
  responseId,
  createdAt,
  model,
  instructions,
  previousResponseId,
  conversationId,
  configuredTools,
  responseMetadata,
  fallbackText,
}: {
  agentMemoryStore: MemoryStorage | null;
  didStore: boolean;
  threadContext: ThreadExecutionContext | null;
  result: ResponseExecutionResult | ResponseStreamResult;
  responseId: string;
  createdAt: number;
  model: string;
  instructions: string | undefined;
  previousResponseId?: string;
  conversationId?: string;
  configuredTools: ReturnType<typeof mapMastraToolsToResponseTools>;
  responseMetadata: Omit<
    ResponseTurnRecordMetadata,
    'completedAt' | 'status' | 'usage' | 'providerOptions' | 'messageIds'
  >;
  fallbackText: string;
}): Promise<FinalizedResponse> {
  const completedState = await resolveCompletedResponseState(result, fallbackText);
  const responseMessages = await resolveResponseTurnMessagesForStorage({
    result,
    responseId,
    text: completedState.text,
    threadContext,
  });
  const response = buildCompletedResponse({
    responseId,
    outputMessageId: responseId,
    model,
    createdAt,
    completedAt: completedState.completedAt,
    status: completedState.status,
    text: completedState.text,
    usage: completedState.usage,
    instructions,
    textConfig: responseMetadata.text,
    previousResponseId,
    conversationId,
    providerOptions: completedState.providerOptions,
    tools: configuredTools,
    messages: responseMessages,
    store: didStore,
  });

  await storeCompletedResponse({
    agentMemoryStore,
    didStore,
    threadContext,
    responseId,
    metadata: responseMetadata,
    completedState,
    messages: responseMessages,
  });

  return { completedState, response, responseMessages };
}

/**
 * Resolves all request-scoped Mastra primitives needed to execute a Responses create
 * call: the owning agent, the memory thread context, the normalized execution input,
 * and the response-turn metadata that may be persisted later.
 */
async function prepareCreateResponseRequest({
  body,
  mastra,
  requestContext,
}: {
  body: CreateResponseBody;
  mastra: Mastra | undefined;
  requestContext: RequestContext;
}): Promise<PreparedCreateResponseRequest> {
  const executionInput = mapResponseInputToExecutionMessages(body.input) as AgentExecutionInput;
  const agent = await resolveResponseAgent({
    mastra,
    agentId: body.agent_id,
  });
  const resolvedModel = await agent.getModel({
    requestContext,
    modelConfig: body.model,
  });
  const responseModel =
    body.model ??
    (() => {
      if (resolvedModel.provider && resolvedModel.modelId) {
        const publicProviderId = resolvedModel.provider.includes('.')
          ? resolvedModel.provider.split('.')[0]!
          : resolvedModel.provider;
        return `${publicProviderId}/${resolvedModel.modelId}`;
      }

      if (resolvedModel.modelId) {
        return resolvedModel.modelId;
      }

      throw new HTTPException(500, {
        message: 'Responses route could not determine the effective model for this request',
      });
    })();
  const shouldStore = body.store ?? false;
  const needsMemoryStore = shouldStore || Boolean(body.conversation_id) || Boolean(body.previous_response_id);
  const agentMemoryStore = needsMemoryStore
    ? await resolveAgentMemoryStore({
        agent,
        requestContext,
        errorMessage: body.previous_response_id
          ? 'previous_response_id requires the target agent to have memory storage configured'
          : shouldStore
            ? 'Stored responses require the target agent to have memory storage configured'
            : 'conversation_id requires the target agent to have memory storage configured',
      })
    : null;
  const previousResponseTurnRecord = body.previous_response_id
    ? await findResponseTurnRecord({ agent, responseId: body.previous_response_id, requestContext })
    : null;

  if (body.previous_response_id && !previousResponseTurnRecord) {
    throw new HTTPException(404, { message: `Stored response ${body.previous_response_id} was not found` });
  }

  const configuredTools = mapMastraToolsToResponseTools(
    (await Promise.resolve(agent.listTools({ requestContext }))) as Record<string, unknown>,
  );

  const responseId = createMessageId();
  const createdAt = Math.floor(Date.now() / 1000);
  const threadContext = await resolveThreadExecutionContext({
    agent,
    store: shouldStore,
    conversationId: body.conversation_id,
    previousResponseTurnRecord,
    requestContext,
  });

  if (shouldStore && !threadContext) {
    throw new HTTPException(400, {
      message: 'Stored responses require the target agent to have memory configured',
    });
  }

  const didStore = shouldStore && Boolean(threadContext);

  return {
    agent,
    agentMemoryStore,
    configuredTools,
    createdAt,
    didStore,
    executionInput,
    previousResponseTurnRecord,
    resolvedModel,
    responseId,
    responseModel,
    responseMetadata: {
      agentId: agent.id,
      model: responseModel,
      createdAt,
      instructions: body.instructions,
      text: body.text,
      previousResponseId: previousResponseTurnRecord?.message.id ?? body.previous_response_id,
      tools: configuredTools,
      store: didStore,
    },
    threadContext,
  };
}

/**
 * Bridges a Mastra agent stream into OpenAI-style Responses SSE events and completes
 * the stored response-turn record when the stream finishes.
 */
function createResponseEventStream({
  agentMemoryStore,
  body,
  configuredTools,
  createdAt,
  didStore,
  previousResponseTurnRecord,
  responseId,
  responseModel,
  responseMetadata,
  streamResult,
  threadContext,
}: {
  agentMemoryStore: MemoryStorage | null;
  body: CreateResponseBody;
  configuredTools: ReturnType<typeof mapMastraToolsToResponseTools>;
  createdAt: number;
  didStore: boolean;
  previousResponseTurnRecord: ResponseTurnRecord | null;
  responseId: string;
  responseModel: string;
  responseMetadata: Omit<
    ResponseTurnRecordMetadata,
    'completedAt' | 'status' | 'usage' | 'providerOptions' | 'messageIds'
  >;
  streamResult: ResponseStreamResult;
  threadContext: ThreadExecutionContext | null;
}) {
  const createdResponse = buildInProgressResponse({
    responseId,
    model: responseModel,
    createdAt,
    instructions: body.instructions,
    textConfig: body.text,
    previousResponseId: body.previous_response_id,
    conversationId: threadContext?.threadId ?? body.conversation_id,
    tools: configuredTools,
    store: didStore,
  });

  return new ReadableStream<Uint8Array>({
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

        const { completedState, response } = await finalizeResponse({
          agentMemoryStore,
          didStore,
          threadContext,
          result: streamResult,
          responseId,
          createdAt,
          model: responseModel,
          instructions: body.instructions,
          previousResponseId: previousResponseTurnRecord?.message.id ?? body.previous_response_id,
          conversationId: threadContext?.threadId ?? body.conversation_id,
          configuredTools,
          responseMetadata,
          fallbackText: text,
        });
        enqueueEvent('response.output_text.done', {
          type: 'response.output_text.done',
          output_index: 0,
          content_index: 0,
          item_id: responseId,
          text: completedState.text,
        });

        const completedItem = getStreamedMessageOutputItem(response, responseId) ?? {
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
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ mastra, requestContext, abortSignal, ...body }) => {
    try {
      const {
        agent,
        agentMemoryStore,
        configuredTools,
        createdAt,
        didStore,
        executionInput,
        previousResponseTurnRecord,
        resolvedModel,
        responseId,
        responseModel,
        responseMetadata,
        threadContext,
      } = await prepareCreateResponseRequest({ body, mastra, requestContext });

      if (!body.stream) {
        const result = await executeGenerate({
          agent,
          resolvedModel,
          modelOverride: body.model,
          instructions: body.instructions,
          text: body.text,
          providerOptions: body.providerOptions,
          input: executionInput,
          requestContext,
          abortSignal,
          threadContext,
        });

        const { response } = await finalizeResponse({
          agentMemoryStore,
          didStore,
          threadContext,
          result,
          responseId,
          createdAt,
          model: responseModel,
          instructions: body.instructions,
          previousResponseId: previousResponseTurnRecord?.message.id ?? body.previous_response_id,
          conversationId: threadContext?.threadId ?? body.conversation_id,
          configuredTools,
          responseMetadata,
          fallbackText: '',
        });

        return jsonResponse(response);
      }

      const streamResult = await executeStream({
        agent,
        resolvedModel,
        modelOverride: body.model,
        instructions: body.instructions,
        text: body.text,
        providerOptions: body.providerOptions,
        input: executionInput,
        requestContext,
        abortSignal,
        threadContext,
      });

      const stream = createResponseEventStream({
        agentMemoryStore,
        body,
        configuredTools,
        createdAt,
        didStore,
        previousResponseTurnRecord,
        responseId,
        responseModel,
        responseMetadata,
        streamResult,
        threadContext,
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
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ mastra, requestContext, responseId }) => {
    try {
      const responseTurnRecord = await findResponseTurnRecordAcrossAgents({ mastra, responseId, requestContext });
      if (!responseTurnRecord) {
        throw new HTTPException(404, { message: `Stored response ${responseId} was not found` });
      }

      return mapResponseTurnRecordToResponse(responseTurnRecord);
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
  requiresPermission: MastraFGAPermissions.AGENTS_DELETE,
  handler: async ({ mastra, requestContext, responseId }) => {
    try {
      const responseTurnRecord = await findResponseTurnRecordAcrossAgents({ mastra, responseId, requestContext });
      if (!responseTurnRecord) {
        throw new HTTPException(404, { message: `Stored response ${responseId} was not found` });
      }

      await deleteResponseTurnRecord({ responseTurnRecord });

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
