import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import type {
  InteractionUpdate,
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
  id: string;
  name?: string;
  description: string;
  agent: CursorAgentInput;
  model?: ModelSelection;
  mcpServers?: Record<string, McpServerConfig>;
  sendOptions?: SendOptions;
};

export class CursorSDKAgent extends Agent {
  readonly options: CursorAgentOptions;
  #mastra?: Mastra;

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

  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: SDKAgentRunOptions<OUTPUT>,
  ): Promise<FullOutput<OUTPUT>> {
    const prompt = promptToText(messages);
    const runId = options?.runId ?? randomUUID();
    const telemetry = createSDKAgentTelemetry({
      agentId: this.id,
      agentName: this.name,
      provider: PROVIDER,
      modelId: getModelId(getRequestedModel(this.options)),
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
      result = await telemetry.execute(() => runCursorGenerate(prompt, this.options));
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
    const modelId = getModelId(getRequestedModel(this.options));
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
      stream: telemetry.wrapStream(runCursorAsMastraStream(prompt, this.options, runId)),
      options: telemetry.outputOptions(),
    });
  }
}

async function runCursorGenerate(prompt: string, options: CursorAgentOptions): Promise<SDKModelGenerateResult> {
  const agent = await resolveCursorAgent(options.agent);
  const usage = createCursorUsageCollector();
  const run = await agent.send(prompt, createCursorSendOptions(options, usage));
  const result = await run.wait();

  if (result.status === 'error' || result.status === 'cancelled') {
    throw new Error(`Cursor run ${result.id} ended with status ${result.status}`);
  }

  const responseModel = getModelId(result.model ?? run.model ?? getRequestedModel(options));
  const providerMetadata = getCursorProviderMetadata(
    options,
    agent.agentId,
    result.id,
    result.status,
    result.durationMs,
    usage.totals(),
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
  runId: string,
): ReadableStream<ChunkType> {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const textId = randomUUID();
      const usage = createCursorUsageCollector();
      let text = '';

      try {
        const agent = await resolveCursorAgent(options.agent);
        const run = await agent.send(prompt, createCursorSendOptions(options, usage));
        const responseId = run.id;
        const responseModel = getModelId(run.model ?? getRequestedModel(options));

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
        );
        enqueueFinishChunks(controller, {
          runId,
          prompt,
          textId,
          text,
          responseId,
          modelId: getModelId(result.model ?? run.model ?? getRequestedModel(options)),
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

function createCursorSendOptions(options: CursorAgentOptions, usage: CursorUsageCollector): SendOptions {
  const sendOptions = {
    ...options.sendOptions,
    mcpServers: options.sendOptions?.mcpServers ?? options.mcpServers,
    model: options.sendOptions?.model ?? options.model,
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
  return options.sendOptions?.model ?? options.model;
}

function getModelId(model: ModelSelection | undefined): string {
  if (!model) {
    return MODEL_ID;
  }

  return typeof model === 'string' ? model : model.id;
}

function getCursorProviderMetadata(
  options: CursorAgentOptions,
  agentId: string,
  runId: string,
  status?: Run['status'],
  durationMs?: number,
  usage?: CursorUsageTotals,
): ProviderMetadata {
  return createProviderMetadata('cursor', {
    agentId,
    runId,
    status,
    requestedModel: getModelId(getRequestedModel(options)),
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
