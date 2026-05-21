import { randomUUID } from 'node:crypto';
import { ReadableStream, TransformStream } from 'node:stream/web';
import type { ReadableStreamDefaultController } from 'node:stream/web';

import type { AgentExecutionOptionsBase } from '../agent/agent.types';
import { MessageList } from '../agent/message-list';
import type { MessageListInput } from '../agent/message-list';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import { EntityType, SpanType } from '../observability';
import type { AIModelGenerationSpan, IModelSpanTracker, Span, UsageStats } from '../observability';
import { executeWithContext, getOrCreateSpan } from '../observability/utils';
import { RequestContext } from '../request-context';
import type { ChunkType, FullOutput, JSONValue, LanguageModelUsage, ProviderMetadata } from '../stream';
import { ChunkFrom, MastraModelOutput } from '../stream';
import type { MastraModelOutputOptions } from '../stream/types';

export type SDKAgentRunOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT> & {
  signal?: AbortSignal;
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
  };
};

export type SDKModelGenerateResult = {
  content: Array<{ type: 'text'; text: string }>;
  finishReason: { unified: 'stop'; raw: 'stop' };
  usage: V3Usage;
  response: {
    id: string;
    modelId: string;
    timestamp: Date;
  };
  providerMetadata?: ProviderMetadata;
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
}: {
  runId: string;
  prompt: string;
  text: string;
  responseId: string;
  modelId: string;
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
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
  options?: SDKAgentRunOptions<OUTPUT>;
  mastra?: Mastra;
};

export type SDKAgentTelemetry<OUTPUT = unknown> = {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  endGenerate(result: SDKModelGenerateResult): void;
  fail(error: unknown): void;
  wrapStream(stream: ReadableStream<ChunkType>): ReadableStream<ChunkType>;
  outputOptions(): Partial<MastraModelOutputOptions<OUTPUT>>;
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
  options,
  mastra,
}: SDKAgentTelemetryOptions<OUTPUT>): SDKAgentTelemetry<OUTPUT> {
  const requestContext = options?.requestContext ?? new RequestContext();
  const instructions = options?.instructions ? promptToText(options.instructions) : undefined;
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
      maxSteps: options?.maxSteps,
    },
    metadata: {
      runId,
    },
    tracingOptions: options?.tracingOptions,
    tracingContext: options?.tracingContext,
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
    },
    requestContext,
  });
  const modelSpanTracker = getModelSpanTracker(modelSpan);

  let ended = false;

  const endModel = ({
    text,
    usage,
    providerMetadata,
    finishReason = 'stop',
    responseId,
    responseModel,
  }: {
    text: string;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
    finishReason?: string;
    responseId?: string;
    responseModel?: string;
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
  }) => {
    if (ended) {
      return;
    }

    ended = true;
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
      });
    },
    fail,
    wrapStream(stream) {
      const trackedStream = (modelSpanTracker?.wrapStream(stream) ?? stream) as ReadableStream<ChunkType>;
      return wrapStreamForAgentSpan(trackedStream, {
        end,
        fail,
      });
    },
    outputOptions() {
      return {
        onFinish: options?.onFinish,
        onStepFinish: options?.onStepFinish,
        requestContext,
        tracingContext: agentSpan ? { currentSpan: agentSpan } : options?.tracingContext,
      };
    },
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
    responseId: string;
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
      id: responseId,
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
  }: {
    runId: string;
    prompt: string;
    textId: string;
    text: string;
    responseId: string;
    modelId: string;
    usage: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
  },
): void {
  const timestamp = new Date();
  const response = {
    id: responseId,
    modelId,
    timestamp,
  };
  const metadata = {
    providerMetadata,
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
  controller.enqueue({
    type: 'step-finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: responseId,
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

export function sumDefined(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => typeof value === 'number');
  if (defined.length === 0) {
    return undefined;
  }

  return defined.reduce((sum, value) => sum + value, 0);
}
