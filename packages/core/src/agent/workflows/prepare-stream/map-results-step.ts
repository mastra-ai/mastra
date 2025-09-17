import { randomUUID } from 'crypto';
import type { Tool } from 'ai';
import type { AISpan, AISpanType } from '../../../ai-tracing';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../../../memory/types';
import { StructuredOutputProcessor } from '../../../processors';
import type { RuntimeContext } from '../../../runtime-context';
import { ChunkFrom } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { MessageList } from '../../message-list';
import type { SaveQueueManager } from '../../save-queue';
import type { AgentCapabilities } from './types';

interface MapResultsStepOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT, FORMAT>;
  resourceId?: string;
  runId: string;
  runtimeContext: RuntimeContext;
  memory?: MastraMemory;
  memoryConfig?: MemoryConfig;
  saveQueueManager: SaveQueueManager;
  agentAISpan: AISpan<AISpanType.AGENT_RUN>;
  instructions: string;
}

export function createMapResultsStep<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({
  capabilities,
  options,
  resourceId,
  runId,
  runtimeContext,
  memory,
  memoryConfig,
  saveQueueManager,
  agentAISpan,
  instructions,
}: MapResultsStepOptions<OUTPUT, FORMAT>) {
  return async ({ inputData, bail }: any) => {
    const toolsData = inputData['prepare-tools-step'] as { convertedTools: Record<string, Tool> };
    const memoryData = inputData['prepare-memory-step'] as {
      threadExists: boolean;
      thread?: StorageThreadType;
      messageList?: MessageList;
      tripwire?: boolean;
      tripwireReason?: string;
    };

    const result = {
      ...options,
      tools: toolsData.convertedTools,
      runId,
      temperature: options.modelSettings?.temperature,
      toolChoice: options.toolChoice,
      thread: memoryData.thread,
      threadId: memoryData.thread?.id,
      resourceId,
      runtimeContext,
      messageList: memoryData.messageList,
      onStepFinish: async (props: any) => {
        if (options.savePerStep) {
          if (!memoryData.threadExists && memory && memoryData.thread) {
            await memory.createThread({
              threadId: memoryData.thread?.id,
              title: memoryData.thread?.title,
              metadata: memoryData.thread?.metadata,
              resourceId: memoryData.thread?.resourceId,
              memoryConfig,
            });

            memoryData.threadExists = true;
          }

          await capabilities.saveStepMessages({
            saveQueueManager,
            result: props,
            messageList: memoryData.messageList!,
            threadId: memoryData.thread?.id,
            memoryConfig,
            runId,
          });
        }

        return options.onStepFinish?.({ ...props, runId });
      },
      ...(memoryData.tripwire && {
        tripwire: memoryData.tripwire,
        tripwireReason: memoryData.tripwireReason,
      }),
    };

    // Check for tripwire and return early if triggered
    if (result.tripwire) {
      const emptyResult = {
        textStream: (async function* () {
          // Empty async generator - yields nothing
        })(),
        fullStream: new globalThis.ReadableStream({
          start(controller: any) {
            controller.enqueue({
              type: 'tripwire',
              runId: result.runId,
              from: ChunkFrom.AGENT,
              payload: {
                tripwireReason: result.tripwireReason,
              },
            });
            controller.close();
          },
        }),
        objectStream: new globalThis.ReadableStream({
          start(controller: any) {
            controller.close();
          },
        }),
        text: Promise.resolve(''),
        usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
        finishReason: Promise.resolve('other'),
        tripwire: true,
        tripwireReason: result.tripwireReason,
        response: {
          id: randomUUID(),
          timestamp: new Date(),
          modelId: 'tripwire',
          messages: [],
        },
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([]),
        warnings: Promise.resolve(undefined),
        request: {
          body: JSON.stringify({ messages: [] }),
        },
        object: undefined,
        experimental_output: undefined,
        steps: undefined,
        experimental_providerMetadata: undefined,
      };

      return bail(emptyResult);
    }

    let effectiveOutputProcessors =
      options.outputProcessors ||
      (capabilities.outputProcessors
        ? typeof capabilities.outputProcessors === 'function'
          ? await capabilities.outputProcessors({
              runtimeContext: result.runtimeContext!,
            })
          : capabilities.outputProcessors
        : []);

    // Handle structuredOutput option by creating an StructuredOutputProcessor
    if (options.structuredOutput) {
      const agentModel = await capabilities.getModel({ runtimeContext: result.runtimeContext! });
      const structuredProcessor = new StructuredOutputProcessor(options.structuredOutput, agentModel);
      effectiveOutputProcessors = effectiveOutputProcessors
        ? [...effectiveOutputProcessors, structuredProcessor]
        : [structuredProcessor];
    }

    const messageList = memoryData.messageList!;

    const loopOptions: ModelLoopStreamArgs<any, OUTPUT> = {
      runtimeContext: result.runtimeContext!,
      tracingContext: { currentSpan: agentAISpan },
      runId,
      toolChoice: result.toolChoice,
      tools: result.tools,
      resourceId: result.resourceId,
      threadId: result.threadId,
      structuredOutput: result.structuredOutput as any,
      stopWhen: result.stopWhen,
      maxSteps: result.maxSteps,
      providerOptions: result.providerOptions,
      options: {
        ...(options.prepareStep && { prepareStep: options.prepareStep }),
        onFinish: async (payload: any) => {
          if (payload.finishReason === 'error') {
            capabilities.logger.error('Error in agent stream', {
              error: payload.error,
              runId,
            });
            return;
          }

          try {
            const outputText = messageList.get.all
              .core()
              .map((m: any) => m.content)
              .join('\n');

            await capabilities.executeOnFinish({
              result: payload,
              outputText,
              instructions,
              thread: result.thread,
              threadId: result.threadId,
              readOnlyMemory: options.memory?.readOnly,
              resourceId,
              memoryConfig,
              runtimeContext,
              agentAISpan: agentAISpan,
              runId,
              messageList,
              threadExists: memoryData.threadExists,
              structuredOutput: !!options.output,
              saveQueueManager,
              overrideScorers: options.scorers,
            });
          } catch (e) {
            capabilities.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }

          await options?.onFinish?.({
            ...payload,
            runId,
            messages: messageList.get.response.aiV5.model(),
            usage: payload.usage,
            totalUsage: payload.totalUsage,
          });
        },
        onStepFinish: result.onStepFinish,
        onChunk: options.onChunk,
        onError: options.onError,
        onAbort: options.onAbort,
        activeTools: options.activeTools,
        abortSignal: options.abortSignal,
      },
      output: options.output,
      outputProcessors: effectiveOutputProcessors,
      modelSettings: {
        temperature: 0,
        ...(options.modelSettings || {}),
      },
      messageList: memoryData.messageList!,
    };

    return loopOptions;
  };
}
