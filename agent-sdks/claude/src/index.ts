import { ReadableStream } from 'node:stream/web';

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ModelUsage, Options as ClaudeQueryOptions, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { Agent } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { CostContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import type {
  ChunkType,
  FullOutput,
  LanguageModelUsage,
  ProviderMetadata,
  MastraModelOutput,
} from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import {
  createMastraOutput,
  createNoopModel,
  createProviderMetadata,
  createSDKAgentTelemetry,
  enqueueFinishChunks,
  enqueueStartChunks,
  enqueueTextDelta,
  getStructuredOutputFromValue,
  getStructuredOutputSchema,
  promptToText,
  sumDefined,
  toFullOutput,
  toLanguageModelUsage,
} from './utils';
import type { SDKAgentRunOptions, SDKAgentTelemetry, SDKModelGenerateResult, V3Usage } from './utils';

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

export type ClaudeSDKOptions = ClaudeQueryOptions;

export type ClaudeAgentOptions = {
  /**
   * Mastra agent id used when registering this wrapper with Mastra.
   */
  id: string;
  /**
   * Optional display name for the Mastra agent. Defaults to `id`.
   */
  name?: string;
  /**
   * Description surfaced by Mastra when listing or selecting agents.
   */
  description: string;
  /**
   * Claude Agent SDK options forwarded to `query()` on every run.
   */
  sdkOptions?: ClaudeSDKOptions;
};

export type ClaudeSDKAgentRunOptions<OUTPUT = unknown> = SDKAgentRunOptions<OUTPUT> & {
  /**
   * Claude Agent SDK query options for this run. These are merged over the
   * wrapper's `sdkOptions`, which allows per-call session continuation options
   * such as `resume` or `continue`.
   */
  sdkOptions?: ClaudeSDKOptions;
};

export type ClaudeSDKAgentResumeData =
  | {
      /**
       * Message to send while resuming the Claude SDK session.
       */
      message: MessageListInput;
      /**
       * Claude session id to resume.
       */
      sessionId: string;
      /**
       * Fork the resumed session into a new session.
       */
      forkSession?: boolean;
      /**
       * Resume the session up to a specific assistant message UUID.
       */
      resumeSessionAt?: string;
    }
  | {
      /**
       * Message to send while continuing the latest Claude SDK session.
       */
      message: MessageListInput;
      /**
       * Continue the latest Claude session in the current working directory.
       */
      continue: true;
    };

export class ClaudeSDKAgent extends Agent {
  readonly options: ClaudeAgentOptions;
  #mastra?: Mastra;

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

  override __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
  }

  supportsMemory(): boolean {
    return false;
  }

  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: ClaudeSDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? crypto.randomUUID();
    const requestContext = options?.requestContext ?? new RequestContext();
    const instructions = options?.instructions ? promptToText(options.instructions) : undefined;
    const telemetry = createSDKAgentTelemetry({
      agentId: this.id,
      agentName: this.name,
      provider: PROVIDER,
      modelId: getModelId(this.options),
      messages,
      prompt,
      runId,
      streaming: false,
      method: 'generate',
      requestContext,
      instructions,
      maxSteps: options?.maxSteps,
      tracingOptions: options?.tracingOptions,
      tracingContext: options?.tracingContext,
      onFinish: options?.onFinish,
      onStepFinish: options?.onStepFinish,
      mastra: this.#mastra,
    });
    let result: SDKModelGenerateResult;
    try {
      result = await telemetry.execute(() => runClaudeGenerate(prompt, this.options, telemetry, options));
      telemetry.endGenerate(result);
    } catch (error) {
      telemetry.fail(error);
      throw error;
    }

    return toFullOutput<OUTPUT>({
      messages,
      runId,
      provider: PROVIDER,
      result,
      options: { ...telemetry.outputOptions(), structuredOutput: options?.structuredOutput as any },
    });
  }

  async stream<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: ClaudeSDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const runId = options?.runId ?? crypto.randomUUID();
    const prompt = promptToText(messages);
    const modelId = getModelId(this.options);
    const requestContext = options?.requestContext ?? new RequestContext();
    const instructions = options?.instructions ? promptToText(options.instructions) : undefined;
    const telemetry = createSDKAgentTelemetry({
      agentId: this.id,
      agentName: this.name,
      provider: PROVIDER,
      modelId,
      messages,
      prompt,
      runId,
      streaming: true,
      method: 'stream',
      requestContext,
      instructions,
      maxSteps: options?.maxSteps,
      tracingOptions: options?.tracingOptions,
      tracingContext: options?.tracingContext,
      onFinish: options?.onFinish,
      onStepFinish: options?.onStepFinish,
      mastra: this.#mastra,
    });

    return createMastraOutput<OUTPUT>({
      messages,
      runId,
      modelId,
      provider: PROVIDER,
      stream: telemetry.wrapStream(runClaudeAsMastraStream(prompt, this.options, runId, telemetry, options)),
      options: { ...telemetry.outputOptions(), structuredOutput: options?.structuredOutput as any },
    });
  }

  async resumeGenerate<OUTPUT = undefined>(
    resumeData: ClaudeSDKAgentResumeData,
    options?: ClaudeSDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const data = validateClaudeResumeData(resumeData);
    return this.generate(data.message, createClaudeResumeRunOptions(data, options));
  }

  async resumeStream<OUTPUT = undefined>(
    resumeData: ClaudeSDKAgentResumeData,
    options?: ClaudeSDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const data = validateClaudeResumeData(resumeData);
    return this.stream(data.message, createClaudeResumeRunOptions(data, options));
  }
}

function validateClaudeResumeData(resumeData: ClaudeSDKAgentResumeData): ClaudeSDKAgentResumeData {
  if (!isRecord(resumeData) || !('message' in resumeData)) {
    throw new Error('ClaudeSDKAgent resumeData must include a message.');
  }

  const hasSessionId = 'sessionId' in resumeData;
  const hasContinue = 'continue' in resumeData;

  if (hasSessionId && hasContinue) {
    throw new Error('ClaudeSDKAgent resumeData must include either sessionId or continue: true, not both.');
  }

  if (hasSessionId) {
    if (typeof resumeData.sessionId !== 'string') {
      throw new Error('ClaudeSDKAgent resumeData.sessionId must be a string.');
    }
    return resumeData;
  }

  if (hasContinue) {
    if (resumeData.continue !== true) {
      throw new Error('ClaudeSDKAgent resumeData.continue must be true when provided.');
    }
    return resumeData;
  }

  throw new Error('ClaudeSDKAgent resumeData must include sessionId or continue: true.');
}

function createClaudeResumeRunOptions<OUTPUT>(
  resumeData: ClaudeSDKAgentResumeData,
  options?: ClaudeSDKAgentRunOptions<OUTPUT>,
): ClaudeSDKAgentRunOptions<OUTPUT> {
  const sdkOptions: ClaudeSDKOptions = { ...options?.sdkOptions };

  if ('sessionId' in resumeData && typeof resumeData.sessionId === 'string') {
    sdkOptions.resume = resumeData.sessionId;
    if (resumeData.forkSession !== undefined) {
      sdkOptions.forkSession = resumeData.forkSession;
    }
    if (resumeData.resumeSessionAt !== undefined) {
      sdkOptions.resumeSessionAt = resumeData.resumeSessionAt;
    }
  } else {
    sdkOptions.continue = true;
  }

  return {
    ...options,
    sdkOptions,
  };
}

async function runClaudeGenerate<OUTPUT>(
  prompt: string,
  options: ClaudeAgentOptions,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  runOptions?: ClaudeSDKAgentRunOptions<OUTPUT>,
): Promise<SDKModelGenerateResult> {
  let text = '';
  let structuredOutputValue: unknown;
  const usage = createClaudeUsageCollector();

  for await (const message of observeClaudeMessages(
    runClaude(prompt, options, runOptions?.abortSignal ?? runOptions?.signal, runOptions),
    telemetry,
  )) {
    usage.record(message);
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(message.errors.join('\n') || `Claude Agent SDK failed with ${message.subtype}`);
      }

      text = message.result;
      structuredOutputValue = getClaudeStructuredOutput(message);
    }
  }

  const totals = usage.totals();
  const object = await getStructuredOutputFromValue(
    structuredOutputValue === undefined ? text : structuredOutputValue,
    runOptions?.structuredOutput,
  );

  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: usage.toV3Usage(),
    response: {
      id: crypto.randomUUID(),
      modelId: getModelId(options),
      timestamp: new Date(),
    },
    providerMetadata: getClaudeProviderMetadata(options, totals),
    costContext: getClaudeCostContext(options, totals),
    object,
  };
}

function runClaudeAsMastraStream<OUTPUT>(
  prompt: string,
  options: ClaudeAgentOptions,
  runId: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  runOptions?: ClaudeSDKAgentRunOptions<OUTPUT>,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = crypto.randomUUID();
      const responseId = crypto.randomUUID();
      const modelId = getModelId(options);
      const usage = createClaudeUsageCollector();
      let text = '';
      let structuredOutputValue: unknown;
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

        for await (const message of observeClaudeMessages(
          runClaude(prompt, options, runOptions?.abortSignal ?? runOptions?.signal, runOptions),
          telemetry,
        )) {
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
            structuredOutputValue = getClaudeStructuredOutput(message);
          }
        }

        const totals = usage.totals();
        const providerMetadata = getClaudeProviderMetadata(options, totals);
        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId,
          usage: usage.toLanguageModelUsage(),
          providerMetadata,
          costContext: getClaudeCostContext(options, totals),
          object: await getStructuredOutputFromValue(
            structuredOutputValue === undefined ? text : structuredOutputValue,
            runOptions?.structuredOutput,
          ),
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

function runClaude<OUTPUT>(
  prompt: string,
  options: ClaudeAgentOptions,
  signal?: AbortSignal,
  runOptions?: ClaudeSDKAgentRunOptions<OUTPUT>,
): AsyncIterable<SDKMessage> {
  const abortController = createAbortController(signal);
  const queryOptions: ClaudeSDKOptions = {
    ...options.sdkOptions,
    ...runOptions?.sdkOptions,
  };
  const outputSchema = getStructuredOutputSchema(runOptions?.structuredOutput);
  if (outputSchema) {
    queryOptions.outputFormat = {
      type: 'json_schema',
      schema: outputSchema,
    };
  }
  if (abortController) {
    queryOptions.abortController = abortController;
  }

  return query({
    prompt,
    options: queryOptions as Parameters<typeof query>[0]['options'],
  }) as AsyncIterable<SDKMessage>;
}

function getClaudeStructuredOutput(message: SDKMessage): unknown {
  if (message.type !== 'result') {
    return undefined;
  }

  return (message as { structured_output?: unknown }).structured_output;
}

async function* observeClaudeMessages<OUTPUT>(
  messages: AsyncIterable<SDKMessage>,
  telemetry: SDKAgentTelemetry<OUTPUT>,
): AsyncIterable<SDKMessage> {
  for await (const message of messages) {
    recordClaudeToolTelemetry(message, telemetry);
    yield message;
  }
}

function recordClaudeToolTelemetry<OUTPUT>(message: SDKMessage, telemetry: SDKAgentTelemetry<OUTPUT>): void {
  for (const toolCall of getClaudeToolCalls(message)) {
    telemetry.startToolCall(toolCall);
  }

  for (const toolResult of getClaudeToolResults(message)) {
    telemetry.endToolCall(toolResult);
  }
}

function getClaudeToolCalls(message: SDKMessage): Array<{ toolCallId: string; toolName: string; input?: unknown }> {
  if (message.type !== 'assistant') {
    return [];
  }

  return getContentBlocks(message.message)
    .filter(isRecord)
    .filter(block => block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string')
    .map(block => ({
      toolCallId: block.id as string,
      toolName: block.name as string,
      input: block.input,
    }));
}

function getClaudeToolResults(message: SDKMessage): Array<{ toolCallId: string; output?: unknown; isError?: boolean }> {
  if (message.type !== 'user') {
    return [];
  }

  return getContentBlocks(message.message)
    .filter(isRecord)
    .filter(block => block.type === 'tool_result' && typeof block.tool_use_id === 'string')
    .map(block => ({
      toolCallId: block.tool_use_id as string,
      output: block.content,
      isError: block.is_error === true,
    }));
}

function getContentBlocks(message: unknown): unknown[] {
  if (!isRecord(message)) {
    return [];
  }

  return Array.isArray(message.content) ? message.content : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
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
  return options.sdkOptions?.model ?? MODEL_ID;
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
      const assistantUsage = getAssistantUsageTotals(assistantUsageById);

      if (hasAnyUsage(resultUsage)) {
        return {
          ...resultUsage,
          inputTokens: resultUsage.inputTokens ?? assistantUsage.inputTokens,
          outputTokens: resultUsage.outputTokens ?? assistantUsage.outputTokens,
          cacheReadInputTokens: resultUsage.cacheReadInputTokens ?? assistantUsage.cacheReadInputTokens,
          cacheCreationInputTokens: resultUsage.cacheCreationInputTokens ?? assistantUsage.cacheCreationInputTokens,
        };
      }

      return assistantUsage;
    },
    toV3Usage(): V3Usage {
      return toV3Usage(this.totals());
    },
    toLanguageModelUsage(): LanguageModelUsage {
      return toLanguageModelUsage(toV3Usage(this.totals()));
    },
  };
}

function getAssistantUsageTotals(assistantUsageById: Map<string, ClaudeUsageTotals>): ClaudeUsageTotals {
  return [...assistantUsageById.values()].reduce<ClaudeUsageTotals>((totals, item) => {
    totals.inputTokens = addOptional(totals.inputTokens, item.inputTokens);
    totals.outputTokens = addOptional(totals.outputTokens, item.outputTokens);
    totals.cacheReadInputTokens = addOptional(totals.cacheReadInputTokens, item.cacheReadInputTokens);
    totals.cacheCreationInputTokens = addOptional(totals.cacheCreationInputTokens, item.cacheCreationInputTokens);
    return totals;
  }, {});
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
  const queryOptions = options.sdkOptions;

  return createProviderMetadata('claude', {
    totalCostUsd: usage?.totalCostUsd,
    model: getModelId(options),
    cwd: queryOptions?.cwd,
    permissionMode: queryOptions?.permissionMode,
    maxTurns: queryOptions?.maxTurns,
    allowedTools: queryOptions?.allowedTools,
    disallowedTools: queryOptions?.disallowedTools,
    usage,
  });
}

function getClaudeCostContext(options: ClaudeAgentOptions, usage?: ClaudeUsageTotals): CostContext | undefined {
  if (typeof usage?.totalCostUsd !== 'number') {
    return undefined;
  }

  return {
    provider: 'anthropic',
    model: getModelId(options),
    estimatedCost: usage.totalCostUsd,
    costUnit: 'USD',
    costMetadata: {
      source: 'sdk_estimate',
      sdkProvider: PROVIDER,
      sdkCostField: 'total_cost_usd',
      scope: 'query_total',
      modelUsage: usage.modelUsage,
    },
  };
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
