import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import { Agent as CursorAgent } from '@cursor/sdk';
import type {
  AgentOptions as CursorCreateOptions,
  InteractionUpdate,
  ModelSelection,
  Run,
  SDKAgent,
  SDKMessage,
  SendOptions,
} from '@cursor/sdk';

import { Agent } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
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
  promptToText,
  sumDefined,
  toFullOutput,
  toLanguageModelUsage,
} from './utils';
import type { SDKAgentRunOptions, SDKAgentTelemetry, SDKModelGenerateResult, V3Usage } from './utils';

const PROVIDER = '@cursor/sdk';
const MODEL_ID = 'cursor-agent-sdk';

type CursorUsageTotals = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

type CursorToolTelemetry = Pick<SDKAgentTelemetry, 'startToolCall' | 'endToolCall'>;

export type CursorAgentFactory = (options: CursorCreateOptions) => SDKAgent | Promise<SDKAgent>;
export type CursorAgentInput = SDKAgent | Promise<SDKAgent> | CursorAgentFactory;

export type CursorSDKAgentResumeData = {
  /**
   * Message to send while continuing the Cursor SDK agent.
   */
  message: MessageListInput;
  /**
   * Cursor SDK agent id to resume. If omitted, the wrapped SDK agent is reused.
   */
  agentId?: string;
  /**
   * Cursor SDK options used only when `agentId` is provided.
   */
  sdkOptions?: Partial<CursorCreateOptions>;
};

export type CursorAgentOptions = {
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
   * Cursor SDK agent or factory. Pass a pre-created SDK agent when you manage
   * its lifecycle elsewhere. Omit this option to let this wrapper call
   * `CursorAgent.create()` with `sdkOptions`.
   *
   * If you pass `CursorAgent.create({...})`, that promise has already been
   * created by the Cursor SDK and wrapper-level create options cannot be
   * merged into it. Put all Cursor create options in that call, or pass the
   * factory itself as `agent: CursorAgent.create`.
   *
   * The factory path allows Mastra to hydrate defaults such as `apiKey`.
   */
  agent?: CursorAgentInput;
  /**
   * Cursor SDK options used when `agent` is omitted or when `agent` is a
   * factory. Defaults `apiKey` to `process.env.CURSOR_API_KEY` when not
   * provided.
   */
  sdkOptions?: CursorCreateOptions;
};

export class CursorSDKAgent extends Agent {
  readonly options: CursorAgentOptions;
  #mastra?: Mastra;
  #createdAgent?: Promise<SDKAgent>;

  constructor(options: CursorAgentOptions) {
    super({
      id: options.id,
      name: options.name ?? options.id,
      description: options.description,
      instructions: '',
      model: createNoopModel({
        modelId: getModelId(getRequestedModel(options)),
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
    assertStructuredOutputUnsupported(options);
    const sdkAgent = await this.resolveCursorAgent();
    return this.generateWithAgent(messages, sdkAgent, options);
  }

  private async generateWithAgent<OUTPUT = undefined>(
    messages: MessageListInput,
    sdkAgent: SDKAgent,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const modelId = getCursorModelId(this.options, sdkAgent);
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
      result = await telemetry.execute(() => runCursorGenerate(prompt, this.options, sdkAgent, telemetry));
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
      options: telemetry.outputOptions(),
    });
  }

  async stream<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    assertStructuredOutputUnsupported(options);
    const sdkAgent = await this.resolveCursorAgent();
    return this.streamWithAgent(messages, sdkAgent, options);
  }

  private async streamWithAgent<OUTPUT = undefined>(
    messages: MessageListInput,
    sdkAgent: SDKAgent,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const runId = options?.runId ?? randomUUID();
    const prompt = promptToText(messages);
    const modelId = getCursorModelId(this.options, sdkAgent);
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
      stream: telemetry.wrapStream(runCursorAsMastraStream(prompt, this.options, sdkAgent, runId, telemetry)),
      options: telemetry.outputOptions(),
    });
  }

  async resumeGenerate<OUTPUT = undefined>(
    resumeData: CursorSDKAgentResumeData,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    assertStructuredOutputUnsupported(options);
    const data = validateCursorResumeData(resumeData);
    const sdkAgent = await this.resolveResumeCursorAgent(data);
    return this.generateWithAgent(data.message, sdkAgent, options);
  }

  async resumeStream<OUTPUT = undefined>(
    resumeData: CursorSDKAgentResumeData,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    assertStructuredOutputUnsupported(options);
    const data = validateCursorResumeData(resumeData);
    const sdkAgent = await this.resolveResumeCursorAgent(data);
    return this.streamWithAgent(data.message, sdkAgent, options);
  }

  private resolveCursorAgent(): Promise<SDKAgent> {
    this.#createdAgent ??= resolveCursorAgent(this.options.agent, this.options).catch(error => {
      this.#createdAgent = undefined;
      throw error;
    });
    return this.#createdAgent;
  }

  private async resolveResumeCursorAgent(resumeData: CursorSDKAgentResumeData): Promise<SDKAgent> {
    if (!resumeData.agentId) {
      return this.resolveCursorAgent();
    }

    return CursorAgent.resume(resumeData.agentId, {
      ...toCursorCreateOptions(this.options),
      ...resumeData.sdkOptions,
    });
  }
}

function validateCursorResumeData(resumeData: CursorSDKAgentResumeData): CursorSDKAgentResumeData {
  if (!toRecord(resumeData) || !('message' in resumeData)) {
    throw new Error('CursorSDKAgent resumeData must include a message.');
  }

  if (resumeData.agentId !== undefined && typeof resumeData.agentId !== 'string') {
    throw new Error('CursorSDKAgent resumeData.agentId must be a string when provided.');
  }

  return resumeData;
}

function assertStructuredOutputUnsupported(options?: unknown): void {
  const structuredOutput = toRecord(toRecord(options)?.structuredOutput);
  if (structuredOutput && 'schema' in structuredOutput) {
    throw new Error(
      'CursorSDKAgent does not support structuredOutput because the Cursor TypeScript SDK does not expose a schema-constrained output API.',
    );
  }
}

async function runCursorGenerate(
  prompt: string,
  options: CursorAgentOptions,
  agent: SDKAgent,
  telemetry: CursorToolTelemetry,
): Promise<SDKModelGenerateResult> {
  const usage = createCursorUsageCollector();
  const run = await agent.send(prompt, createCursorSendOptions(options, usage, telemetry));
  const result = await run.wait();

  if (result.status === 'error' || result.status === 'cancelled') {
    throw new Error(`Cursor run ${result.id} ended with status ${result.status}`);
  }

  const responseModel = getModelId(result.model ?? run.model ?? getRequestedModel(options) ?? agent.model);
  const providerMetadata = getCursorProviderMetadata(
    options,
    agent.agentId,
    result.id,
    result.status,
    result.durationMs,
    usage.totals(),
    responseModel,
  );

  return {
    content: [{ type: 'text', text: result.result ?? '' }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: usage.toV3Usage(),
    response: {
      id: result.id,
      modelId: responseModel,
      timestamp: new Date(),
    },
    providerMetadata,
  };
}

function runCursorAsMastraStream(
  prompt: string,
  options: CursorAgentOptions,
  agent: SDKAgent,
  runId: string,
  telemetry: CursorToolTelemetry,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      const usage = createCursorUsageCollector();
      let text = '';

      try {
        const run = await agent.send(prompt, createCursorSendOptions(options, usage, telemetry));
        const responseId = run.id;
        const responseModel = getModelId(run.model ?? getRequestedModel(options) ?? agent.model);

        enqueueStartChunks(controller, {
          runId,
          prompt,
          textId,
          responseId,
          modelId: responseModel,
          providerMetadata: getCursorProviderMetadata(
            options,
            agent.agentId,
            run.id,
            run.status,
            run.durationMs,
            usage.totals(),
            responseModel,
          ),
        });

        let result: Awaited<ReturnType<Run['wait']>> | undefined;
        if (run.supports('stream')) {
          for await (const message of run.stream()) {
            const delta = getTextFromCursorMessage(message);
            if (delta) {
              text += delta;
              enqueueTextDelta(controller, runId, textId, delta);
            }
          }
          result = await run.wait();
        } else {
          result = await run.wait();
          if (result.status === 'error' || result.status === 'cancelled') {
            throw new Error(`Cursor run ${result.id} ended with status ${result.status}`);
          }
          if (result.result) {
            text += result.result;
            enqueueTextDelta(controller, runId, textId, result.result);
          }
        }

        if (result.status === 'error' || result.status === 'cancelled') {
          throw new Error(`Cursor run ${result.id} ended with status ${result.status}`);
        }

        if (!text && result.result) {
          text = result.result;
          enqueueTextDelta(controller, runId, textId, result.result);
        }

        const providerMetadata = getCursorProviderMetadata(
          options,
          agent.agentId,
          run.id,
          result.status,
          result.durationMs,
          usage.totals(),
          getModelId(result.model ?? run.model ?? getRequestedModel(options) ?? agent.model),
        );
        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId: getModelId(result.model ?? run.model ?? getRequestedModel(options) ?? agent.model),
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

async function resolveCursorAgent(agent: CursorAgentInput | undefined, options: CursorAgentOptions): Promise<SDKAgent> {
  if (!agent) {
    return CursorAgent.create(toCursorCreateOptions(options));
  }

  return typeof agent === 'function' ? agent(toCursorCreateOptions(options)) : agent;
}

function toCursorCreateOptions(options: CursorAgentOptions): CursorCreateOptions {
  const createOptions: CursorCreateOptions = { ...options.sdkOptions };
  const apiKey = createOptions.apiKey ?? process.env['CURSOR_API_KEY'];

  if (apiKey) createOptions.apiKey = apiKey;
  if (options.name && !createOptions.name) createOptions.name = options.name;

  return createOptions;
}

function createCursorSendOptions(
  options: CursorAgentOptions,
  usage: CursorUsageCollector,
  telemetry: CursorToolTelemetry,
): SendOptions {
  return {
    mcpServers: options.sdkOptions?.mcpServers,
    onDelta: async args => {
      usage.record(args.update);
      recordCursorToolTelemetry(args.update, telemetry);
    },
  };
}

type CursorUsageCollector = ReturnType<typeof createCursorUsageCollector>;

function createCursorUsageCollector() {
  const totals: Required<CursorUsageTotals> = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };

  return {
    record(update: InteractionUpdate) {
      if (update.type !== 'turn-ended' || !update.usage) {
        return;
      }

      totals.inputTokens += update.usage.inputTokens;
      totals.outputTokens += update.usage.outputTokens;
      totals.cacheReadTokens += update.usage.cacheReadTokens;
      totals.cacheWriteTokens += update.usage.cacheWriteTokens;
    },
    totals(): CursorUsageTotals {
      return {
        inputTokens: totals.inputTokens || undefined,
        outputTokens: totals.outputTokens || undefined,
        cacheReadTokens: totals.cacheReadTokens || undefined,
        cacheWriteTokens: totals.cacheWriteTokens || undefined,
      };
    },
    toV3Usage(): V3Usage {
      return toV3Usage(totals);
    },
    toLanguageModelUsage(): LanguageModelUsage {
      return toLanguageModelUsage(toV3Usage(totals));
    },
  };
}

function toV3Usage(usage: CursorUsageTotals): V3Usage {
  const noCache = usage.inputTokens;
  const cacheRead = usage.cacheReadTokens;
  const cacheWrite = usage.cacheWriteTokens;
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

function getRequestedModel(options: CursorAgentOptions): ModelSelection | undefined {
  return options.sdkOptions?.model;
}

function getModelId(model: ModelSelection | undefined): string {
  if (!model) {
    return MODEL_ID;
  }

  return typeof model === 'string' ? model : model.id;
}

function getCursorModelId(options: CursorAgentOptions, agent: SDKAgent): string {
  return getModelId(getRequestedModel(options) ?? agent.model);
}

function getCursorProviderMetadata(
  options: CursorAgentOptions,
  agentId: string,
  runId: string,
  status?: Run['status'],
  durationMs?: number,
  usage?: CursorUsageTotals,
  requestedModel?: string,
): ProviderMetadata {
  return createProviderMetadata('cursor', {
    agentId,
    runId,
    status,
    requestedModel: requestedModel ?? getModelId(getRequestedModel(options)),
    durationMs,
    mcpServerNames: getMcpServerNames(options),
    usage,
  });
}

function getMcpServerNames(options: CursorAgentOptions): string[] | undefined {
  const servers = options.sdkOptions?.mcpServers;
  return servers ? Object.keys(servers) : undefined;
}

function getTextFromCursorMessage(message: SDKMessage): string {
  if (message.type === 'assistant') {
    return message.message.content
      .map(block => {
        if (block.type === 'text') {
          return block.text;
        }

        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (message.type === 'task') {
    return message.text ?? '';
  }

  return '';
}

function recordCursorToolTelemetry(update: InteractionUpdate, telemetry: CursorToolTelemetry): void {
  const updateRecord = toRecord(update);
  if (!updateRecord) {
    return;
  }

  const updateType = typeof updateRecord?.type === 'string' ? updateRecord.type : undefined;

  if (
    updateType !== 'tool-call-started' &&
    updateType !== 'partial-tool-call' &&
    updateType !== 'tool-call-completed'
  ) {
    return;
  }

  const toolCall = getCursorToolCall(updateRecord);
  if (!toolCall) {
    return;
  }

  if (updateType === 'tool-call-started' || updateType === 'partial-tool-call') {
    telemetry.startToolCall({
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCall.input,
    });
    return;
  }

  telemetry.startToolCall({
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    input: toolCall.input,
  });
  telemetry.endToolCall({
    toolCallId: toolCall.toolCallId,
    output: toolCall.output,
    isError: toolCall.isError,
  });
}

function getCursorToolCall(update: Record<string, unknown>):
  | {
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
      isError?: boolean;
    }
  | undefined {
  const toolCallId = typeof update.callId === 'string' ? update.callId : undefined;
  const toolCall = toRecord(update.toolCall);
  if (!toolCallId || !toolCall) {
    return undefined;
  }

  if (toolCall.type === 'mcp') {
    const args = toRecord(toolCall.args);
    if (!args) {
      return undefined;
    }

    const providerIdentifier = typeof args?.providerIdentifier === 'string' ? args.providerIdentifier : undefined;
    const toolName = typeof args?.toolName === 'string' ? args.toolName : undefined;
    if (!providerIdentifier || !toolName) {
      return undefined;
    }

    const result = toRecord(toolCall.result);

    return {
      toolCallId,
      toolName: `mcp__${providerIdentifier}__${toolName}`,
      input: args.args,
      output: result?.value ?? toolCall.result,
      isError: result?.status === 'error' || result?.status === 'failed',
    };
  }

  const toolName =
    typeof toolCall.name === 'string' ? toolCall.name : typeof toolCall.type === 'string' ? toolCall.type : undefined;
  if (!toolName) {
    return undefined;
  }

  return {
    toolCallId,
    toolName,
    input: 'args' in toolCall ? toolCall.args : undefined,
    output: 'result' in toolCall ? toolCall.result : undefined,
    isError: toolCall.status === 'error',
  };
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
