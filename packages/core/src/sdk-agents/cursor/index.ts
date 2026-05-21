import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import type {
  AgentDefinition,
  AgentOptions as CursorCreateOptions,
  CloudAgentOptions,
  CursorAgentPlatformOptions,
  InteractionUpdate,
  LocalAgentOptions,
  McpServerConfig,
  ModelSelection,
  Run,
  SDKAgent,
  SDKMessage,
  SendOptions,
} from '@cursor/sdk';

import { Agent } from '../../agent';
import type { MessageListInput } from '../../agent/message-list';
import type { Mastra } from '../../mastra';
import type { ChunkType, FullOutput, LanguageModelUsage, ProviderMetadata, MastraModelOutput } from '../../stream';
import { ChunkFrom } from '../../stream';
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
} from '../shared';
import type { SDKAgentRunOptions, SDKModelGenerateResult, V3Usage } from '../shared';

const PROVIDER = '@cursor/sdk';
const MODEL_ID = 'cursor-agent-sdk';

type CursorUsageTotals = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type CursorAgentInput = SDKAgent | Promise<SDKAgent> | (() => SDKAgent | Promise<SDKAgent>);

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
   * Pre-created Cursor SDK agent. Pass this when you want full control over
   * `Agent.create()` or when the SDK agent lifecycle is managed elsewhere.
   *
   * If omitted, `CursorSDKAgent` calls `@cursor/sdk`'s `Agent.create()` with
   * the Cursor SDK options provided on this object.
   */
  agent?: CursorAgentInput;
  /**
   * Cursor API key used when `agent` is omitted. Defaults to
   * `process.env.CURSOR_API_KEY` when not provided.
   */
  apiKey?: string;
  /**
   * Cursor model selection used when `agent` is omitted.
   *
   * The Cursor SDK requires an explicit model for local agents.
   */
  model?: ModelSelection;
  /**
   * Cursor local-agent options used when `agent` is omitted.
   */
  local?: LocalAgentOptions;
  /**
   * Cursor cloud-agent options used when `agent` is omitted.
   */
  cloud?: CloudAgentOptions;
  /**
   * MCP servers passed to Cursor when creating the SDK agent and when sending
   * prompts, unless `sendOptions.mcpServers` overrides them for a run.
   */
  mcpServers?: Record<string, McpServerConfig>;
  /**
   * Cursor subagent definitions passed to `Agent.create()` when `agent` is omitted.
   */
  agents?: Record<string, AgentDefinition>;
  /**
   * Existing Cursor agent id to resume/create from when `agent` is omitted.
   */
  agentId?: string;
  /**
   * Cursor idempotency key passed to `Agent.create()` when `agent` is omitted.
   */
  idempotencyKey?: string;
  /**
   * Cursor platform options passed to `Agent.create()` when `agent` is omitted.
   */
  platform?: CursorAgentPlatformOptions;
  /**
   * Options forwarded to each Cursor `agent.send()` call. `onDelta` is wrapped
   * so Mastra can collect usage while preserving your callback.
   */
  sendOptions?: SendOptions;
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
        modelId: getModelId(options.sendOptions?.model),
        provider: PROVIDER,
      }),
    });
    this.options = options;
  }

  override __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
  }

  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const sdkAgent = await this.resolveCursorAgent();
    const modelId = getCursorModelId(this.options, sdkAgent);
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
      options,
      mastra: this.#mastra,
    });
    let result: SDKModelGenerateResult;
    try {
      result = await telemetry.execute(() => runCursorGenerate(prompt, this.options, sdkAgent));
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
    const runId = options?.runId ?? randomUUID();
    const prompt = promptToText(messages);
    const sdkAgent = await this.resolveCursorAgent();
    const modelId = getCursorModelId(this.options, sdkAgent);
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
      options,
      mastra: this.#mastra,
    });

    return createMastraOutput<OUTPUT>({
      messages,
      runId,
      modelId,
      provider: PROVIDER,
      stream: telemetry.wrapStream(runCursorAsMastraStream(prompt, this.options, sdkAgent, runId)),
      options: telemetry.outputOptions(),
    });
  }

  private resolveCursorAgent(): Promise<SDKAgent> {
    if (this.options.agent) {
      return resolveCursorAgent(this.options.agent);
    }

    this.#createdAgent ??= createCursorAgent(this.options);
    return this.#createdAgent;
  }
}

async function runCursorGenerate(
  prompt: string,
  options: CursorAgentOptions,
  agent: SDKAgent,
): Promise<SDKModelGenerateResult> {
  const usage = createCursorUsageCollector();
  const run = await agent.send(prompt, createCursorSendOptions(options, usage));
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
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      const usage = createCursorUsageCollector();
      let text = '';

      try {
        const run = await agent.send(prompt, createCursorSendOptions(options, usage));
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

async function resolveCursorAgent(agent: CursorAgentInput): Promise<SDKAgent> {
  return typeof agent === 'function' ? agent() : agent;
}

async function createCursorAgent(options: CursorAgentOptions): Promise<SDKAgent> {
  const { Agent: CursorAgent } = await import('@cursor/sdk');
  return CursorAgent.create(toCursorCreateOptions(options));
}

function toCursorCreateOptions(options: CursorAgentOptions): CursorCreateOptions {
  const createOptions: CursorCreateOptions = {};
  const apiKey = options.apiKey ?? process.env['CURSOR_API_KEY'];

  if (apiKey) createOptions.apiKey = apiKey;
  if (options.model) createOptions.model = options.model;
  if (options.name) createOptions.name = options.name;
  if (options.local) createOptions.local = options.local;
  if (options.cloud) createOptions.cloud = options.cloud;
  if (options.mcpServers) createOptions.mcpServers = options.mcpServers;
  if (options.agents) createOptions.agents = options.agents;
  if (options.agentId) createOptions.agentId = options.agentId;
  if (options.idempotencyKey) createOptions.idempotencyKey = options.idempotencyKey;
  if (options.platform) createOptions.platform = options.platform;

  return createOptions;
}

function createCursorSendOptions(options: CursorAgentOptions, usage: CursorUsageCollector): SendOptions {
  const sendOptions = {
    ...options.sendOptions,
    mcpServers: options.sendOptions?.mcpServers ?? options.mcpServers,
  };
  const originalOnDelta = sendOptions.onDelta;

  return {
    ...sendOptions,
    onDelta: async args => {
      usage.record(args.update);
      await originalOnDelta?.(args);
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
      if (update.type !== 'turn-ended') {
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
  return options.sendOptions?.model;
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
  const servers = options.sendOptions?.mcpServers ?? options.mcpServers;
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
