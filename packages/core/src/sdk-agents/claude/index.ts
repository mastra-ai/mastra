import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import type { ModelUsage, Options, Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

import { Agent } from '../../agent';
import type { MessageListInput } from '../../agent/message-list';
import type { ChunkType, FullOutput, LanguageModelUsage, ProviderMetadata, MastraModelOutput } from '../../stream';
import { ChunkFrom } from '../../stream';
import {
  createMastraOutput,
  createNoopModel,
  createProviderMetadata,
  enqueueFinishChunks,
  enqueueStartChunks,
  enqueueTextDelta,
  promptToText,
  sumDefined,
  toFullOutput,
  toLanguageModelUsage,
} from '../shared';
import type { SDKAgentRunOptions, SDKModelGenerateResult, V3Usage } from '../shared';

const PROVIDER = '@anthropic-ai/claude-agent-sdk';
const MODEL_ID = 'claude-agent-sdk';

type ClaudeUsageTotals = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  totalCostUsd?: number;
  modelUsage?: Record<string, ModelUsage>;
};

export type ClaudeQueryFunction = (params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}) => Query;
export type ClaudeAgentInput = ClaudeQueryFunction | { query: ClaudeQueryFunction };

export type ClaudeAgentOptions = {
  id: string;
  name?: string;
  description: string;
  agent: ClaudeAgentInput;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  permissionMode?: Options['permissionMode'];
  allowedTools?: string[];
  disallowedTools?: string[];
  env?: Record<string, string>;
  pathToClaudeCodeExecutable?: string;
};

export class ClaudeSDKAgent extends Agent {
  readonly options: ClaudeAgentOptions;

  constructor(options: ClaudeAgentOptions) {
    super({
      id: options.id,
      name: options.name ?? options.id,
      description: options.description,
      instructions: '',
      model: createNoopModel({
        modelId: getModelId(options),
        provider: PROVIDER,
      }),
    });
    this.options = options;
  }

  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const result = await runClaudeGenerate(
      promptToText(messages),
      this.options,
      options?.abortSignal ?? options?.signal,
    );
    const runId = options?.runId ?? result.response.id;

    return toFullOutput<OUTPUT>({
      messages,
      runId,
      provider: PROVIDER,
      result,
    });
  }

  async stream<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const runId = options?.runId ?? randomUUID();
    const prompt = promptToText(messages);

    return createMastraOutput<OUTPUT>({
      messages,
      runId,
      modelId: getModelId(this.options),
      provider: PROVIDER,
      stream: runClaudeAsMastraStream(prompt, this.options, runId, options?.abortSignal ?? options?.signal),
    });
  }
}

async function runClaudeGenerate(
  prompt: string,
  options: ClaudeAgentOptions,
  signal?: AbortSignal,
): Promise<SDKModelGenerateResult> {
  let text = '';
  const usage = createClaudeUsageCollector();

  for await (const message of runClaude(prompt, options, signal)) {
    usage.record(message);
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(message.errors.join('\n') || `Claude Agent SDK failed with ${message.subtype}`);
      }

      text = message.result;
    }
  }

  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: usage.toV3Usage(),
    response: {
      id: randomUUID(),
      modelId: getModelId(options),
      timestamp: new Date(),
    },
    providerMetadata: getClaudeProviderMetadata(options, usage.totals()),
  };
}

function runClaudeAsMastraStream(
  prompt: string,
  options: ClaudeAgentOptions,
  runId: string,
  signal?: AbortSignal,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      const responseId = randomUUID();
      const modelId = getModelId(options);
      const usage = createClaudeUsageCollector();
      let text = '';
      let sawDelta = false;

      try {
        enqueueStartChunks(controller, {
          runId,
          prompt,
          textId,
          responseId,
          modelId,
          providerMetadata: getClaudeProviderMetadata(options, usage.totals()),
        });

        for await (const message of runClaude(prompt, options, signal)) {
          usage.record(message);
          const delta = getTextDelta(message);
          if (delta) {
            sawDelta = true;
            text += delta;
            enqueueTextDelta(controller, runId, textId, delta);
          }

          if (message.type === 'result') {
            if (message.subtype !== 'success') {
              throw new Error(message.errors.join('\n') || `Claude Agent SDK failed with ${message.subtype}`);
            }

            if (!sawDelta && message.result) {
              text += message.result;
              enqueueTextDelta(controller, runId, textId, message.result);
            }
          }
        }

        const providerMetadata = getClaudeProviderMetadata(options, usage.totals());
        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId,
          usage: usage.toLanguageModelUsage(),
          providerMetadata,
        });
        controller.close();
      } catch (error) {
        controller.enqueue({
          type: 'error',
          runId,
          from: ChunkFrom.AGENT,
          payload: { error },
        });
        controller.close();
      }
    },
  });
}

function runClaude(prompt: string, options: ClaudeAgentOptions, signal?: AbortSignal): Query {
  const abortController = createAbortController(signal);
  const agent = options.agent;
  const query = typeof agent === 'function' ? agent : agent.query;

  return query({
    prompt,
    options: {
      cwd: options.cwd,
      model: options.model,
      maxTurns: options.maxTurns,
      permissionMode: options.permissionMode,
      allowedTools: options.allowedTools,
      disallowedTools: options.disallowedTools,
      env: options.env,
      pathToClaudeCodeExecutable: options.pathToClaudeCodeExecutable,
      abortController,
    },
  });
}

function createAbortController(signal: AbortSignal | undefined): AbortController | undefined {
  if (!signal) {
    return undefined;
  }

  const controller = new AbortController();
  if (signal.aborted) {
    controller.abort(signal.reason);
    return controller;
  }

  signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  return controller;
}

function getModelId(options: ClaudeAgentOptions): string {
  return options.model ?? MODEL_ID;
}

function createClaudeUsageCollector() {
  const assistantUsageById = new Map<string, ClaudeUsageTotals>();
  let resultUsage: ClaudeUsageTotals = {};

  return {
    record(message: SDKMessage) {
      if (message.type === 'assistant') {
        assistantUsageById.set(message.message.id, usageFromClaudeMessage(message.message.usage));
        return;
      }

      if (message.type === 'result') {
        resultUsage = {
          ...usageFromClaudeMessage(message.usage),
          totalCostUsd: message.total_cost_usd,
          modelUsage: message.modelUsage,
        };
      }
    },
    totals(): ClaudeUsageTotals {
      if (hasAnyUsage(resultUsage)) {
        return resultUsage;
      }

      return [...assistantUsageById.values()].reduce<ClaudeUsageTotals>((totals, item) => {
        totals.inputTokens = addOptional(totals.inputTokens, item.inputTokens);
        totals.outputTokens = addOptional(totals.outputTokens, item.outputTokens);
        totals.cacheReadInputTokens = addOptional(totals.cacheReadInputTokens, item.cacheReadInputTokens);
        totals.cacheCreationInputTokens = addOptional(totals.cacheCreationInputTokens, item.cacheCreationInputTokens);
        return totals;
      }, {});
    },
    toV3Usage(): V3Usage {
      return toV3Usage(this.totals());
    },
    toLanguageModelUsage(): LanguageModelUsage {
      return toLanguageModelUsage(toV3Usage(this.totals()));
    },
  };
}

function usageFromClaudeMessage(usage: unknown): ClaudeUsageTotals {
  if (!usage || typeof usage !== 'object') {
    return {};
  }

  const record = usage as Record<string, unknown>;
  return {
    inputTokens: getTokenTotal(record.input_tokens),
    outputTokens: getTokenTotal(record.output_tokens),
    cacheReadInputTokens: getTokenTotal(record.cache_read_input_tokens),
    cacheCreationInputTokens: getTokenTotal(record.cache_creation_input_tokens),
  };
}

function hasAnyUsage(usage: ClaudeUsageTotals): boolean {
  return (
    usage.inputTokens !== undefined ||
    usage.outputTokens !== undefined ||
    usage.cacheReadInputTokens !== undefined ||
    usage.cacheCreationInputTokens !== undefined ||
    usage.totalCostUsd !== undefined
  );
}

function addOptional(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }

  return left + right;
}

function toV3Usage(usage: ClaudeUsageTotals): V3Usage {
  const noCache = usage.inputTokens;
  const cacheRead = usage.cacheReadInputTokens;
  const cacheWrite = usage.cacheCreationInputTokens;
  const totalInputTokens = sumDefined(noCache, cacheRead, cacheWrite);
  const outputTokens = usage.outputTokens;

  return {
    inputTokens: {
      total: totalInputTokens,
      noCache,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
    },
  };
}

function getClaudeProviderMetadata(options: ClaudeAgentOptions, usage?: ClaudeUsageTotals): ProviderMetadata {
  return createProviderMetadata('claude', {
    totalCostUsd: usage?.totalCostUsd,
    model: getModelId(options),
    cwd: options.cwd,
    permissionMode: options.permissionMode,
    maxTurns: options.maxTurns,
    allowedTools: options.allowedTools,
    disallowedTools: options.disallowedTools,
    usage,
  });
}

function getTextDelta(message: SDKMessage): string {
  if (message.type !== 'stream_event') {
    return '';
  }

  const event = message.event as {
    type?: string;
    delta?: {
      type?: string;
      text?: string;
    };
  };

  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }

  return '';
}

function getTokenTotal(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
