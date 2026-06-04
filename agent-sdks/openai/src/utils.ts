import { randomUUID } from 'node:crypto';
import { ReadableStream, TransformStream } from 'node:stream/web';
import type { ReadableStreamDefaultController } from 'node:stream/web';

import type { AgentExecutionOptionsBase, MastraLanguageModel, PublicStructuredOutputOptions } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import { EntityType, executeWithContext, getOrCreateSpan, SpanType } from '@mastra/core/observability';
import type {
  AIModelGenerationSpan,
  CostContext,
  IModelSpanTracker,
  Span,
  UsageStats,
} from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/core/schema';
import type { ChunkType, FullOutput, JSONValue, LanguageModelUsage, ProviderMetadata } from '@mastra/core/stream';
import { ChunkFrom, MastraModelOutput } from '@mastra/core/stream';

type MastraModelOutputOptions<OUTPUT = undefined> = ConstructorParameters<
  typeof MastraModelOutput<OUTPUT>
>[0]['options'];

export type SDKAgentRunOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> & {
  signal?: AbortSignal;
  structuredOutput?: OUTPUT extends {} ? PublicStructuredOutputOptions<OUTPUT> : never;
  [key: string]: unknown;
};

export type V3Usage = {
  inputTokens: {
    total: number | undefined;
    noCache?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  outputTokens: {
    total: number | undefined;
    text?: number;
    reasoning?: number;
  };
};

export type SDKModelGenerateResult = {
  content: Array<{ type: 'text'; text: string }>;
  finishReason: { unified: 'stop'; raw: 'stop' };
  usage: V3Usage;
  response: {
    id?: string;
    modelId: string;
    timestamp: Date;
  };
  providerMetadata?: ProviderMetadata;
  costContext?: CostContext;
  object?: unknown;
};

export function createNoopModel({ modelId, provider }: { modelId: string; provider: string }): MastraLanguageModel {
  return {
    modelId,
    provider,
    specificationVersion: 'v3',
    supportedUrls: {},
    doGenerate: async () => createNoopStreamResult(),
    doStream: async () => createNoopStreamResult(),
  } as MastraLanguageModel;
}

function createNoopStreamResult(): { stream: ReadableStream<never> } {
  return {
    stream: new ReadableStream<never>({
      start: controller => controller.close(),
    }),
  };
}

export function createCompletedMastraStream({
  runId,
  prompt,
  text,
  responseId,
  modelId,
  usage,
  providerMetadata,
  costContext,
  object,
}: {
  runId: string;
  prompt: string;
  text: string;
  responseId?: string;
  modelId: string;
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
  costContext?: CostContext;
  object?: unknown;
}): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start(controller) {
      const textId = randomUUID();
      enqueueStartChunks(controller, {
        runId,
        prompt,
        textId,
        responseId,
        modelId,
        providerMetadata,
      });
      if (text) {
        enqueueTextDelta(controller, runId, textId, text);
      }
      enqueueFinishChunks(controller, {
        runId,
        prompt,
        textId,
        text,
        responseId,
        modelId,
        usage,
        providerMetadata,
        costContext,
        object,
      });
      controller.close();
    },
  });
}

export function createMastraOutput<OUTPUT>({
  messages,
  runId,
  modelId,
  provider,
  stream,
  options,
}: {
  messages: MessageListInput;
  runId: string;
  modelId: string;
  provider: string;
  stream: ReadableStream<ChunkType>;
  options?: Partial<MastraModelOutputOptions<OUTPUT>>;
}): MastraModelOutput<OUTPUT> {
  const messageList = new MessageList();
  messageList.add(messages, 'input');
  messageList.add([{ role: 'assistant', content: '' }], 'response');

  return new MastraModelOutput<OUTPUT>({
    model: {
      modelId,
      provider,
      version: 'v3',
    },
    stream: stream as ReadableStream<ChunkType<OUTPUT>>,
    messageList,
    messageId: randomUUID(),
    options: {
      ...options,
      runId,
    },
  });
}

export function toFullOutput<OUTPUT>({
  messages,
  runId,
  provider,
  result,
  options,
}: {
  messages: MessageListInput;
  runId: string;
  provider: string;
  result: SDKModelGenerateResult;
  options?: Partial<MastraModelOutputOptions<OUTPUT>>;
}): Promise<FullOutput<OUTPUT>> {
  const text = result.content.map(part => part.text).join('');
  const stream = createCompletedMastraStream({
    runId,
    prompt: promptToText(messages),
    text,
    responseId: result.response.id,
    modelId: result.response.modelId,
    usage: toLanguageModelUsage(result.usage),
    providerMetadata: result.providerMetadata,
    costContext: result.costContext,
    object: result.object,
  });

  return createMastraOutput<OUTPUT>({
    messages,
    runId,
    modelId: result.response.modelId,
    provider,
    stream,
    options,
  }).getFullOutput();
}

export type SDKAgentTelemetryOptions<OUTPUT = unknown> = {
  agentId: string;
  agentName: string;
  provider: string;
  modelId: string;
  messages: MessageListInput;
  prompt: string;
  runId: string;
  streaming: boolean;
  method: 'generate' | 'stream';
  requestContext: RequestContext;
  instructions?: string;
  maxSteps?: SDKAgentRunOptions<OUTPUT>['maxSteps'];
  tracingOptions?: SDKAgentRunOptions<OUTPUT>['tracingOptions'];
  tracingContext?: SDKAgentRunOptions<OUTPUT>['tracingContext'];
  onFinish?: SDKAgentRunOptions<OUTPUT>['onFinish'];
  onStepFinish?: SDKAgentRunOptions<OUTPUT>['onStepFinish'];
  mastra?: Mastra;
};

export type SDKAgentTelemetry<OUTPUT = unknown> = {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  endGenerate(result: SDKModelGenerateResult): void;
  fail(error: unknown): void;
  startToolCall(input: SDKAgentToolCallInput): void;
  endToolCall(output: SDKAgentToolCallOutput): void;
  wrapStream(stream: ReadableStream<ChunkType>): ReadableStream<ChunkType>;
  outputOptions(): Partial<MastraModelOutputOptions<OUTPUT>>;
};

export type SDKAgentToolCallInput = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

export type SDKAgentToolCallOutput = {
  toolCallId: string;
  output?: unknown;
  isError?: boolean;
};

export function createSDKAgentTelemetry<OUTPUT>({
  agentId,
  agentName,
  provider,
  modelId,
  messages,
  prompt,
  runId,
  streaming,
  method,
  requestContext,
  instructions,
  maxSteps,
  tracingOptions,
  tracingContext,
  onFinish,
  onStepFinish,
  mastra,
}: SDKAgentTelemetryOptions<OUTPUT>): SDKAgentTelemetry<OUTPUT> {
  const agentSpan = getOrCreateSpan({
    type: SpanType.AGENT_RUN,
    name: `agent run: '${agentId}'`,
    entityType: EntityType.AGENT,
    entityId: agentId,
    entityName: agentName,
    input: messages,
    attributes: {
      prompt,
      instructions,
      maxSteps,
    },
    metadata: {
      runId,
      sdkAgent: true,
      sdkProvider: provider,
      sdkMethod: method,
    },
    tracingOptions,
    tracingContext,
    requestContext,
    mastra,
  });

  const modelSpan = agentSpan?.createChildSpan({
    type: SpanType.MODEL_GENERATION,
    name: `llm: '${modelId}'`,
    input: {
      messages,
    },
    attributes: {
      model: modelId,
      provider,
      streaming,
    },
    metadata: {
      runId,
      sdkAgent: true,
      sdkProvider: provider,
      sdkMethod: method,
    },
    requestContext,
  });
  const modelSpanTracker = getModelSpanTracker(modelSpan);
  const toolSpans = new Map<string, Span<SpanType.TOOL_CALL> | Span<SpanType.MCP_TOOL_CALL>>();

  let ended = false;

  const startToolCall = ({ toolCallId, toolName, input }: SDKAgentToolCallInput) => {
    if (toolSpans.has(toolCallId)) {
      return;
    }

    const parentSpan = agentSpan ?? modelSpan;
    if (!parentSpan) {
      return;
    }

    const mcp = parseMcpToolName(toolName);
    const span = mcp
      ? parentSpan.createChildSpan({
          type: SpanType.MCP_TOOL_CALL,
          name: `mcp_tool: '${toolName}' on '${mcp.serverName}'`,
          input,
          entityType: EntityType.TOOL,
          entityId: toolName,
          entityName: toolName,
          attributes: {
            mcpServer: mcp.serverName,
          },
          metadata: {
            runId,
            sdkAgent: true,
            sdkProvider: provider,
            sdkMethod: method,
            toolCallId,
          },
          requestContext,
        })
      : parentSpan.createChildSpan({
          type: SpanType.TOOL_CALL,
          name: `tool: '${toolName}'`,
          input,
          entityType: EntityType.TOOL,
          entityId: toolName,
          entityName: toolName,
          attributes: {
            toolType: 'tool',
          },
          metadata: {
            runId,
            sdkAgent: true,
            sdkProvider: provider,
            sdkMethod: method,
            toolCallId,
          },
          requestContext,
        });

    toolSpans.set(toolCallId, span);
  };

  const endToolCall = ({ toolCallId, output, isError }: SDKAgentToolCallOutput) => {
    const span = toolSpans.get(toolCallId);
    if (!span) {
      return;
    }

    toolSpans.delete(toolCallId);
    if (isError) {
      span.error({
        error:
          output instanceof Error ? output : new Error(typeof output === 'string' ? output : 'SDK tool call failed'),
        attributes: { success: false },
      });
      return;
    }

    span.end({
      output,
      attributes: { success: true },
    });
  };

  const closeOpenToolSpans = (success: boolean, error?: unknown) => {
    for (const [toolCallId, span] of toolSpans) {
      toolSpans.delete(toolCallId);
      if (success) {
        span.end({ attributes: { success: true } });
        continue;
      }

      const normalized = error instanceof Error ? error : new Error(String(error ?? 'SDK agent run failed'));
      span.error({ error: normalized, attributes: { success: false } });
    }
  };

  const endModel = ({
    text,
    usage,
    providerMetadata,
    finishReason = 'stop',
    responseId,
    responseModel,
    costContext,
  }: {
    text: string;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
    finishReason?: string;
    responseId?: string;
    responseModel?: string;
    costContext?: CostContext;
  }) => {
    if (modelSpanTracker) {
      modelSpanTracker.endGeneration({
        output: {
          text,
        },
        attributes: {
          finishReason,
          responseId,
          responseModel,
          costContext,
        },
        usage,
        providerMetadata,
      });
      return;
    }

    modelSpan?.end({
      output: {
        text,
      },
      attributes: {
        finishReason,
        responseId,
        responseModel,
        usage: usage ? toUsageStats(usage) : undefined,
        costContext,
      },
    });
  };

  const end = (result: {
    text: string;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
    finishReason?: string;
    responseId?: string;
    responseModel?: string;
    costContext?: CostContext;
  }) => {
    if (ended) {
      return;
    }

    ended = true;
    closeOpenToolSpans(true);
    endModel(result);
    agentSpan?.end({
      output: {
        text: result.text,
      },
    });
  };

  const fail = (error: unknown) => {
    if (ended) {
      return;
    }

    ended = true;
    const normalized = error instanceof Error ? error : new Error(String(error));
    closeOpenToolSpans(false, normalized);
    if (modelSpanTracker) {
      modelSpanTracker.reportGenerationError({ error: normalized });
    } else {
      modelSpan?.error({ error: normalized });
    }
    agentSpan?.error({ error: normalized });
  };

  return {
    execute: fn => executeWithContext({ span: modelSpan ?? agentSpan, fn }),
    endGenerate(result) {
      end({
        text: result.content.map(part => part.text).join(''),
        usage: toLanguageModelUsage(result.usage),
        providerMetadata: result.providerMetadata,
        finishReason: result.finishReason.unified,
        responseId: result.response.id,
        responseModel: result.response.modelId,
        costContext: result.costContext,
      });
    },
    fail,
    startToolCall,
    endToolCall,
    wrapStream(stream) {
      const trackedStream = (modelSpanTracker?.wrapStream(stream) ?? stream) as ReadableStream<ChunkType>;
      return wrapStreamForAgentSpan(trackedStream, {
        end,
        fail,
      });
    },
    outputOptions() {
      return {
        onFinish,
        onStepFinish,
        requestContext,
        tracingContext: agentSpan ? { currentSpan: agentSpan } : tracingContext,
      };
    },
  };
}

function parseMcpToolName(toolName: string): { serverName: string; toolName: string } | undefined {
  const match = /^mcp__([^_].*?)__(.+)$/.exec(toolName);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    serverName: match[1],
    toolName: match[2],
  };
}

function getModelSpanTracker(
  modelSpan: Span<SpanType.MODEL_GENERATION> | AIModelGenerationSpan | undefined,
): IModelSpanTracker | undefined {
  if (!modelSpan || !('createTracker' in modelSpan)) {
    return undefined;
  }

  return modelSpan.createTracker();
}

function wrapStreamForAgentSpan(
  stream: ReadableStream<ChunkType>,
  telemetry: {
    end: (result: {
      text: string;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      finishReason?: string;
      responseId?: string;
      responseModel?: string;
      costContext?: CostContext;
    }) => void;
    fail: (error: unknown) => void;
  },
): ReadableStream<ChunkType> {
  let text = '';

  return stream.pipeThrough(
    new TransformStream<ChunkType, ChunkType>({
      transform(chunk, controller) {
        if (chunk.type === 'text-delta') {
          text += chunk.payload.text;
        }

        if (chunk.type === 'finish') {
          telemetry.end({
            text,
            usage: chunk.payload.output.usage,
            providerMetadata: chunk.payload.providerMetadata,
            finishReason: chunk.payload.stepResult.reason,
            responseId: chunk.payload.response?.id,
            responseModel: chunk.payload.response?.modelId,
            costContext: getCostContext(chunk.payload.metadata?.costContext),
          });
        }

        if (chunk.type === 'error') {
          telemetry.fail(chunk.payload.error);
        }

        controller.enqueue(chunk);
      },
      flush() {
        telemetry.end({ text });
      },
    }),
  );
}

function toUsageStats(usage: LanguageModelUsage): UsageStats {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    inputDetails: {
      cacheRead: usage.cachedInputTokens,
      cacheWrite: usage.cacheCreationInputTokens,
    },
    outputDetails: {
      text: usage.outputTokens,
      reasoning: usage.reasoningTokens,
    },
  };
}

function getCostContext(value: unknown): CostContext | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as CostContext;
}

export function enqueueStartChunks(
  controller: ReadableStreamDefaultController<ChunkType>,
  {
    runId,
    prompt,
    textId,
    responseId,
    modelId,
    providerMetadata,
  }: {
    runId: string;
    prompt: string;
    textId: string;
    responseId?: string;
    modelId: string;
    providerMetadata?: ProviderMetadata;
  },
): void {
  controller.enqueue({
    type: 'start',
    runId,
    from: ChunkFrom.AGENT,
    payload: {},
  });
  controller.enqueue({
    type: 'step-start',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      request: { body: prompt },
    },
  });
  controller.enqueue({
    type: 'response-metadata',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      ...(responseId ? { id: responseId } : {}),
      modelId,
      timestamp: new Date().toISOString(),
    },
  });
  controller.enqueue({
    type: 'text-start',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: textId,
      providerMetadata,
    },
  });
}

export function enqueueTextDelta(
  controller: ReadableStreamDefaultController<ChunkType>,
  runId: string,
  textId: string,
  text: string,
): void {
  controller.enqueue({
    type: 'text-delta',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: textId,
      text,
    },
  });
}

export function enqueueFinishChunks(
  controller: ReadableStreamDefaultController<ChunkType>,
  {
    runId,
    prompt,
    textId,
    text,
    responseId,
    modelId,
    usage,
    providerMetadata,
    costContext,
    object,
  }: {
    runId: string;
    prompt: string;
    textId: string;
    text: string;
    responseId?: string;
    modelId: string;
    usage: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
    costContext?: CostContext;
    object?: unknown;
  },
): void {
  const timestamp = new Date();
  const response = {
    ...(responseId ? { id: responseId } : {}),
    modelId,
    timestamp,
  };
  const metadata = {
    providerMetadata,
    costContext,
    request: { body: prompt },
    modelId,
    timestamp,
  };

  controller.enqueue({
    type: 'text-end',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: textId,
      providerMetadata,
    },
  });
  if (object !== undefined) {
    controller.enqueue({
      type: 'object-result',
      runId,
      from: ChunkFrom.AGENT,
      object,
    } as unknown as ChunkType);
  }
  controller.enqueue({
    type: 'step-finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      ...(responseId ? { id: responseId } : {}),
      providerMetadata,
      totalUsage: usage,
      response,
      stepResult: {
        reason: 'stop',
        warnings: [],
      },
      output: {
        text,
        usage,
        steps: [],
      },
      metadata,
    },
  });
  controller.enqueue({
    type: 'finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      stepResult: {
        reason: 'stop',
        warnings: [],
      },
      output: {
        usage,
        steps: [],
      },
      metadata,
      providerMetadata,
      messages: {
        all: [],
        user: [],
        nonUser: [],
      },
      response,
    },
  });
}

export function toLanguageModelUsage(usage: V3Usage): LanguageModelUsage {
  const inputTokens = usage.inputTokens.total ?? 0;
  const outputTokens = usage.outputTokens.total ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cachedInputTokens: usage.inputTokens.cacheRead,
    cacheCreationInputTokens: usage.inputTokens.cacheWrite,
    reasoningTokens: usage.outputTokens.reasoning,
    raw: usage,
  };
}

export function createProviderMetadata(provider: string, metadata: Record<string, unknown>): ProviderMetadata {
  return {
    [provider]: toJsonRecord(metadata),
  };
}

function toJsonRecord(record: Record<string, unknown>): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, Exclude<unknown, undefined>] => entry[1] !== undefined)
      .map(([key, value]) => [key, toJsonValue(value)]),
  );
}

function toJsonValue(value: unknown): JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined).map(toJsonValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return toJsonRecord(value as Record<string, unknown>);
  }

  return String(value);
}

export function promptToText(prompt: unknown): string {
  if (typeof prompt === 'string') {
    return prompt;
  }

  if (Array.isArray(prompt)) {
    return prompt.map(promptToText).filter(Boolean).join('\n');
  }

  if (!prompt || typeof prompt !== 'object') {
    return '';
  }

  const record = prompt as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }
  if (typeof record.content === 'string') {
    return record.content;
  }
  if (record.content) {
    return promptToText(record.content);
  }

  return '';
}

export function withStructuredOutputPrompt<OUTPUT>(
  prompt: string,
  structuredOutput?: PublicStructuredOutputOptions<OUTPUT>,
): string {
  if (!structuredOutput?.schema) {
    return prompt;
  }

  const schema = standardSchemaToJSONSchema(toStandardSchema(structuredOutput.schema));
  const instructions =
    structuredOutput.instructions ??
    'Return only valid JSON that matches the JSON Schema. Do not include markdown fences or explanatory text.';

  return `${prompt}\n\n${instructions}\n\nJSON Schema:\n${JSON.stringify(schema)}`;
}

export function getStructuredOutputSchema<OUTPUT>(
  structuredOutput?: PublicStructuredOutputOptions<OUTPUT>,
): Record<string, unknown> | undefined {
  if (!structuredOutput?.schema) {
    return undefined;
  }

  return {
    type: 'json_schema',
    name: 'mastra_output',
    strict: false,
    schema: standardSchemaToJSONSchema(toStandardSchema(structuredOutput.schema)) as Record<string, unknown>,
  };
}

export async function getStructuredOutput<OUTPUT>(
  text: string,
  structuredOutput?: PublicStructuredOutputOptions<OUTPUT>,
): Promise<OUTPUT | undefined> {
  return getStructuredOutputFromValue(text, structuredOutput);
}

export async function getStructuredOutputFromValue<OUTPUT>(
  value: unknown,
  structuredOutput?: PublicStructuredOutputOptions<OUTPUT>,
): Promise<OUTPUT | undefined> {
  if (!structuredOutput?.schema) {
    return undefined;
  }

  let parsed: unknown;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return handleStructuredOutputError(
        new Error('Structured output must be valid JSON.', { cause: error }),
        structuredOutput,
      );
    }
  } else {
    parsed = value;
  }

  const schema = toStandardSchema(structuredOutput.schema);
  const result = await schema['~standard'].validate(parsed);
  if (!result.issues) {
    return result.value as OUTPUT;
  }

  const message = result.issues.map(issue => `- ${issue.path?.join('.') || 'root'}: ${issue.message}`).join('\n');
  return handleStructuredOutputError(new Error(`Structured output validation failed:\n${message}`), structuredOutput);
}

function handleStructuredOutputError<OUTPUT>(
  error: Error,
  structuredOutput: PublicStructuredOutputOptions<OUTPUT>,
): OUTPUT | undefined {
  if (structuredOutput.errorStrategy === 'fallback') {
    return structuredOutput.fallbackValue;
  }

  if (structuredOutput.errorStrategy === 'warn') {
    structuredOutput.logger?.warn(error.message);
    return undefined;
  }

  throw error;
}

export function sumDefined(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => typeof value === 'number');
  if (defined.length === 0) {
    return undefined;
  }

  return defined.reduce((sum, value) => sum + value, 0);
}
