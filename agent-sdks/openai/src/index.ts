import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import { Agent } from '@mastra/core/agent';
import type { StructuredOutputOptions } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ChunkType, FullOutput, ProviderMetadata, MastraModelOutput } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import { Agent as OpenAIAgent, run } from '@openai/agents';
import type { AgentOptions as OpenAIAgentOptions, RunItem, RunStreamEvent } from '@openai/agents';
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

const PROVIDER = '@openai/agents';
const MODEL_ID = 'openai-agents-sdk';

type OpenAIUsageTotals = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  reasoningTokens?: number;
  requests?: number;
  requestUsageEntries?: unknown[];
};

type OpenAIToolTelemetry = Pick<SDKAgentTelemetry, 'startToolCall' | 'endToolCall'>;
type OpenAIStructuredOutputOption<OUTPUT> = OUTPUT extends {} ? StructuredOutputOptions<OUTPUT> : never;

export type OpenAISDKAgentResumeData = {
  /**
   * Message to send while continuing the OpenAI Agents SDK run.
   */
  message: MessageListInput;
  /**
   * Previous OpenAI response id to continue from.
   */
  previousResponseId?: string;
  /**
   * OpenAI conversation id for server-managed conversation state.
   */
  conversationId?: string;
  /**
   * OpenAI Agents SDK session object for client-managed conversation state.
   */
  session?: unknown;
};

type OpenAISDKAgentBaseOptions = {
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
};

export type OpenAISDKAgentOptions = OpenAISDKAgentBaseOptions &
  (
    | {
        /**
         * Pre-created OpenAI Agents SDK agent. Pass this when you manage the
         * SDK agent lifecycle yourself.
         */
        agent: OpenAIAgent;
        sdkOptions?: never;
      }
    | {
        agent?: never;
        /**
         * OpenAI Agents SDK options used to create an SDK agent.
         */
        sdkOptions: OpenAIAgentOptions;
      }
  );

export class OpenAISDKAgent extends Agent {
  readonly options: OpenAISDKAgentOptions;
  #mastra?: Mastra;
  #createdAgent?: OpenAIAgent;

  constructor(options: OpenAISDKAgentOptions) {
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
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const sdkAgent = getRunOpenAIAgent(this.resolveOpenAIAgent(), options);
    const modelId = getModelId(this.options, sdkAgent);
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
      result = await telemetry.execute(() => runOpenAIGenerate(prompt, sdkAgent, runId, telemetry, options));
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
      options: { ...telemetry.outputOptions(), structuredOutput: getStructuredOutputOption(options) },
    });
  }

  async stream<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const sdkAgent = getRunOpenAIAgent(this.resolveOpenAIAgent(), options);
    const modelId = getModelId(this.options, sdkAgent);
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
      stream: telemetry.wrapStream(runOpenAIAsMastraStream(prompt, sdkAgent, runId, modelId, telemetry, options)),
      options: { ...telemetry.outputOptions(), structuredOutput: getStructuredOutputOption(options) },
    });
  }

  async resumeGenerate<OUTPUT = undefined>(
    resumeData: OpenAISDKAgentResumeData,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const data = validateOpenAIResumeData(resumeData);
    return this.generate(data.message, createOpenAIResumeRunOptions(data, options));
  }

  async resumeStream<OUTPUT = undefined>(
    resumeData: OpenAISDKAgentResumeData,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const data = validateOpenAIResumeData(resumeData);
    return this.stream(data.message, createOpenAIResumeRunOptions(data, options));
  }

  private resolveOpenAIAgent(): OpenAIAgent {
    this.#createdAgent ??= this.options.agent ?? new OpenAIAgent(toOpenAIAgentOptions(this.options));
    return this.#createdAgent;
  }
}

function getStructuredOutputOption<OUTPUT>(
  options?: SDKAgentRunOptions<OUTPUT>,
): OpenAIStructuredOutputOption<OUTPUT> | undefined {
  return options?.structuredOutput as OpenAIStructuredOutputOption<OUTPUT> | undefined;
}

function validateOpenAIResumeData(resumeData: OpenAISDKAgentResumeData): OpenAISDKAgentResumeData {
  const record = toRecord(resumeData);
  if (!record || !('message' in record)) {
    throw new Error('OpenAISDKAgent resumeData must include a message.');
  }

  if (
    typeof resumeData.previousResponseId === 'string' ||
    typeof resumeData.conversationId === 'string' ||
    resumeData.session !== undefined
  ) {
    return resumeData;
  }

  throw new Error('OpenAISDKAgent resumeData must include previousResponseId, conversationId, or session.');
}

function createOpenAIResumeRunOptions<OUTPUT>(
  resumeData: OpenAISDKAgentResumeData,
  options?: SDKAgentRunOptions<OUTPUT>,
): SDKAgentRunOptions<OUTPUT> {
  return {
    ...options,
    previousResponseId: resumeData.previousResponseId ?? options?.previousResponseId,
    conversationId: resumeData.conversationId ?? options?.conversationId,
    session: resumeData.session ?? options?.session,
  };
}

async function runOpenAIGenerate<OUTPUT>(
  prompt: string,
  agent: OpenAIAgent,
  runId: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  options?: SDKAgentRunOptions<OUTPUT>,
): Promise<SDKModelGenerateResult> {
  const result = await run(agent, prompt, createOpenAIRunOptions(options, false));

  recordOpenAIToolTelemetry(result.newItems, telemetry);
  const text = getTextFromFinalOutput(result.finalOutput);
  const responseId = result.lastResponseId;
  const modelId = getModelId(undefined, result.lastAgent ?? agent, result.rawResponses.at(-1));
  const usage = createOpenAIUsageTotals(result.state.usage);
  const providerMetadata = getOpenAIProviderMetadata({
    modelId,
    responseId,
    lastResponseId: result.lastResponseId,
    rawResponseCount: result.rawResponses.length,
    itemCount: result.newItems.length,
    usage,
  });

  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: toV3Usage(usage),
    response: {
      id: responseId,
      modelId,
      timestamp: new Date(),
    },
    providerMetadata,
    object: await getStructuredOutputFromValue(result.finalOutput, options?.structuredOutput),
  };
}

function runOpenAIAsMastraStream<OUTPUT>(
  prompt: string,
  agent: OpenAIAgent,
  runId: string,
  requestedModelId: string,
  telemetry: SDKAgentTelemetry<OUTPUT>,
  options?: SDKAgentRunOptions<OUTPUT>,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      let text = '';
      let responseId: string | undefined;
      let modelId = requestedModelId;

      try {
        const result = await run(agent, prompt, createOpenAIRunOptions(options, true));

        enqueueStartChunks(controller, {
          runId,
          prompt,
          textId,
          responseId,
          modelId,
        });

        for await (const event of result) {
          const delta = getTextDelta(event);
          if (delta) {
            text += delta;
            enqueueTextDelta(controller, runId, textId, delta);
          }

          recordOpenAIStreamToolTelemetry(event, telemetry);
        }

        await result.completed;

        responseId = result.lastResponseId ?? responseId;
        modelId = getModelId(undefined, result.lastAgent ?? agent, result.rawResponses.at(-1));
        if (!text) {
          text = getTextFromFinalOutput(result.finalOutput);
          if (text) {
            enqueueTextDelta(controller, runId, textId, text);
          }
        }

        const usage = createOpenAIUsageTotals(result.state.usage);
        const providerMetadata = getOpenAIProviderMetadata({
          modelId,
          responseId,
          lastResponseId: result.lastResponseId,
          rawResponseCount: result.rawResponses.length,
          itemCount: result.newItems.length,
          usage,
        });

        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId,
          usage: toLanguageModelUsage(toV3Usage(usage)),
          providerMetadata,
          object: await getStructuredOutputFromValue(result.finalOutput, options?.structuredOutput),
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

function toOpenAIAgentOptions(options: OpenAISDKAgentOptions): OpenAIAgentOptions {
  return {
    name: options.name ?? options.id,
    ...options.sdkOptions,
  };
}

function getRunOpenAIAgent<OUTPUT>(agent: OpenAIAgent, options?: SDKAgentRunOptions<OUTPUT>): OpenAIAgent {
  const outputType = getStructuredOutputSchema(options?.structuredOutput);
  if (!outputType) {
    return agent;
  }

  return (agent as { clone(config: Record<string, unknown>): OpenAIAgent }).clone({ outputType });
}

function createOpenAIRunOptions<OUTPUT>(
  options: SDKAgentRunOptions<OUTPUT> | undefined,
  stream: false,
): Record<string, unknown> & { stream: false };
function createOpenAIRunOptions<OUTPUT>(
  options: SDKAgentRunOptions<OUTPUT> | undefined,
  stream: true,
): Record<string, unknown> & { stream: true };
function createOpenAIRunOptions<OUTPUT>(
  options: SDKAgentRunOptions<OUTPUT> | undefined,
  stream: boolean,
): Record<string, unknown> & { stream: boolean } {
  const runOptions: Record<string, unknown> & { stream: boolean } = { stream };
  addDefined(runOptions, 'maxTurns', options?.maxSteps);
  addDefined(runOptions, 'signal', options?.abortSignal ?? options?.signal);
  addDefined(runOptions, 'conversationId', options?.conversationId);
  addDefined(runOptions, 'previousResponseId', options?.previousResponseId);
  addDefined(runOptions, 'session', options?.session);

  return runOptions;
}

function addDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function getModelId(options?: OpenAISDKAgentOptions, agent?: OpenAIAgent, rawResponse?: unknown): string {
  return (
    getModelNameFromUnknown(rawResponse) ??
    getModelNameFromUnknown(agent?.model) ??
    getModelNameFromUnknown(options?.sdkOptions?.model) ??
    MODEL_ID
  );
}

function getModelNameFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  const record = toRecord(value);
  return (
    getString(record, 'model') ??
    getString(record, 'modelId') ??
    getString(record, 'modelName') ??
    getString(toRecord(record?.providerData), 'model')
  );
}

function getTextFromFinalOutput(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (output === undefined || output === null) {
    return '';
  }

  return JSON.stringify(output);
}

function createOpenAIUsageTotals(usage: unknown): OpenAIUsageTotals {
  const record = toRecord(usage);
  if (!record) {
    return {};
  }

  const inputDetails = getDetailRecords(record.inputTokensDetails);
  const outputDetails = getDetailRecords(record.outputTokensDetails);
  const requestUsageEntries = Array.isArray(record.requestUsageEntries) ? record.requestUsageEntries : undefined;

  return {
    inputTokens: getNumber(record.inputTokens),
    outputTokens: getNumber(record.outputTokens),
    cacheReadInputTokens: sumDetails(inputDetails, 'cachedTokens', 'cached_tokens', 'cacheReadInputTokens'),
    cacheCreationInputTokens: sumDetails(inputDetails, 'cacheCreationInputTokens', 'cache_creation_input_tokens'),
    reasoningTokens: sumDetails(outputDetails, 'reasoningTokens', 'reasoning_tokens'),
    requests: getNumber(record.requests),
    requestUsageEntries,
  };
}

function getDetailRecords(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  const record = toRecord(value);
  return record ? [record] : [];
}

function sumDetails(records: Array<Record<string, unknown>>, ...keys: string[]): number | undefined {
  let total = 0;
  let found = false;

  for (const record of records) {
    for (const key of keys) {
      const value = getNumber(record[key]);
      if (value !== undefined) {
        total += value;
        found = true;
      }
    }
  }

  return found ? total : undefined;
}

function toV3Usage(usage: OpenAIUsageTotals): V3Usage {
  const totalInputTokens = usage.inputTokens;
  const cacheRead = usage.cacheReadInputTokens;
  const cacheWrite = usage.cacheCreationInputTokens;
  const noCache =
    totalInputTokens === undefined
      ? undefined
      : Math.max(totalInputTokens - (sumDefined(cacheRead, cacheWrite) ?? 0), 0);
  const outputTokens = usage.outputTokens;
  const reasoningTokens = usage.reasoningTokens;

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
      reasoning: reasoningTokens,
    },
  };
}

function getOpenAIProviderMetadata({
  modelId,
  responseId,
  lastResponseId,
  rawResponseCount,
  itemCount,
  usage,
}: {
  modelId: string;
  responseId?: string;
  lastResponseId?: string;
  rawResponseCount: number;
  itemCount: number;
  usage: OpenAIUsageTotals;
}): ProviderMetadata {
  return createProviderMetadata('openai', {
    model: modelId,
    responseId,
    lastResponseId,
    rawResponseCount,
    itemCount,
    usage,
  });
}

function recordOpenAIToolTelemetry(items: RunItem[], telemetry: OpenAIToolTelemetry): void {
  for (const item of items) {
    if (item.type === 'tool_call_item') {
      const toolCall = getOpenAIToolCall(item.rawItem);
      if (toolCall) {
        telemetry.startToolCall(toolCall);
      }
      continue;
    }

    if (item.type === 'tool_call_output_item') {
      const toolOutput = getOpenAIToolOutput(item.rawItem, item.output);
      if (toolOutput) {
        telemetry.endToolCall(toolOutput);
      }
    }
  }
}

function recordOpenAIStreamToolTelemetry(event: RunStreamEvent, telemetry: OpenAIToolTelemetry): void {
  if (event.type !== 'run_item_stream_event') {
    return;
  }

  if (event.name === 'tool_called') {
    const toolCall = getOpenAIToolCall(event.item.rawItem);
    if (toolCall) {
      telemetry.startToolCall(toolCall);
    }
    return;
  }

  if (event.name === 'tool_output') {
    const toolOutput = getOpenAIToolOutput(event.item.rawItem, getObjectValue(event.item, 'output'));
    if (toolOutput) {
      telemetry.endToolCall(toolOutput);
    }
  }
}

function getOpenAIToolCall(rawItem: unknown): { toolCallId: string; toolName: string; input?: unknown } | undefined {
  const record = toRecord(rawItem);
  if (!record) {
    return undefined;
  }

  if (record.type === 'function_call') {
    const toolCallId = getString(record, 'callId') ?? getString(record, 'id');
    const toolName = getNamespacedToolName(record);
    if (!toolCallId || !toolName) {
      return undefined;
    }

    return {
      toolCallId,
      toolName,
      input: parseJsonString(record.arguments),
    };
  }

  if (record.type === 'hosted_tool_call') {
    const toolCallId = getString(record, 'id') ?? getString(record, 'name');
    const toolName = getString(record, 'name');
    if (!toolCallId || !toolName) {
      return undefined;
    }

    return {
      toolCallId,
      toolName,
      input: parseJsonString(record.arguments),
    };
  }

  if (record.type === 'shell_call' || record.type === 'apply_patch_call') {
    const toolCallId = getString(record, 'callId');
    if (!toolCallId) {
      return undefined;
    }

    return {
      toolCallId,
      toolName: String(record.type),
      input: record.action ?? record.operation,
    };
  }

  return undefined;
}

function getOpenAIToolOutput(
  rawItem: unknown,
  fallbackOutput: unknown,
): { toolCallId: string; output?: unknown; isError?: boolean } | undefined {
  const record = toRecord(rawItem);
  if (!record) {
    return undefined;
  }

  const toolCallId = getString(record, 'callId') ?? getString(record, 'id');
  if (!toolCallId) {
    return undefined;
  }

  return {
    toolCallId,
    output: record.output ?? fallbackOutput,
    isError: record.status === 'failed' || record.status === 'incomplete',
  };
}

function getNamespacedToolName(record: Record<string, unknown>): string | undefined {
  const name = getString(record, 'name');
  const namespace = getString(record, 'namespace');
  if (!name) {
    return undefined;
  }

  return namespace ? `${namespace}.${name}` : name;
}

function getTextDelta(event: RunStreamEvent): string {
  if (event.type !== 'raw_model_stream_event') {
    return '';
  }

  const data = toRecord(event.data);
  return data?.type === 'output_text_delta' && typeof data.delta === 'string' ? data.delta : '';
}

function parseJsonString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function getString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getObjectValue(value: unknown, key: string): unknown {
  return toRecord(value)?.[key];
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
