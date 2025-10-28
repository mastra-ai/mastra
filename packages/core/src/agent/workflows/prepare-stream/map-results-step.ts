import type { TracingContext } from '../../../ai-tracing';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import { StructuredOutputProcessor } from '../../../processors';
import type { OutputSchema } from '../../../stream/base/schema';
import type { SaveQueueManager } from '../../save-queue';
import { getModelOutputForTripwire } from '../../trip-wire';
import type { AgentCapabilities, PrepareMemoryStepOutput, PrepareToolsStepOutput } from './schema';
import type { prepareStreamWorkflowInputSchema } from './index';
import type { z } from 'zod';

interface MapResultsStepOptions {
  agentId: string;
}

export function createMapResultsStep<
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({ agentId }: MapResultsStepOptions) {
  return async ({
    inputData,
    bail,
    tracingContext,
    runtimeContext,
    getInitData,
  }: {
    inputData: {
      'prepare-tools-step': PrepareToolsStepOutput;
      'prepare-memory-step': PrepareMemoryStepOutput;
    };
    bail: <T>(value: T) => T;
    tracingContext: TracingContext;
    runtimeContext: any; // RuntimeContext from workflow execution
    getInitData: () => any;
  }) => {
    // Get workflow input data
    const workflowInput = getInitData() as z.infer<typeof prepareStreamWorkflowInputSchema>;
    const {
      options,
      capabilities,
      saveQueueManager,
      resourceId,
      runId,
      memory,
      memoryConfig,
      instructions,
      returnScorerData,
      requireToolApproval,
      resumeContext,
      toolCallId,
      format,
    } = workflowInput;
    const agentAISpan = tracingContext.currentSpan;
    const toolsData = inputData['prepare-tools-step'];
    const memoryData = inputData['prepare-memory-step'];

    const result = {
      ...options,
      agentId,
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
      const agentModel = await capabilities.getModel({ runtimeContext: result.runtimeContext! });

      const modelOutput = await getModelOutputForTripwire({
        tripwireReason: result.tripwireReason!,
        runId,
        tracingContext,
        options,
        model: agentModel,
        messageList: memoryData.messageList,
      });

      return bail(modelOutput);
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
    // Only create the processor if a model is explicitly provided
    if (options.structuredOutput?.model) {
      const structuredProcessor = new StructuredOutputProcessor(options.structuredOutput);
      effectiveOutputProcessors = effectiveOutputProcessors
        ? [...effectiveOutputProcessors, structuredProcessor]
        : [structuredProcessor];
    }

    const messageList = memoryData.messageList!;

    const loopOptions = {
      agentId,
      runtimeContext: result.runtimeContext!,
      tracingContext: { currentSpan: agentAISpan },
      runId,
      toolChoice: result.toolChoice,
      tools: result.tools,
      resourceId: result.resourceId,
      threadId: result.threadId,
      stopWhen: result.stopWhen,
      maxSteps: result.maxSteps,
      providerOptions: result.providerOptions,
      returnScorerData,
      resumeContext,
      toolCallId,
      // Extra fields needed by streamStep
      format,
      requireToolApproval,
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
              .map(m => m.content)
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
              agentAISpan: agentAISpan as any,
              runId,
              messageList,
              threadExists: memoryData.threadExists,
              structuredOutput: !!options.structuredOutput?.schema,
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
      structuredOutput: options.structuredOutput,
      outputProcessors: effectiveOutputProcessors,
      modelSettings: {
        temperature: 0,
        ...(options.modelSettings || {}),
      },
      messageList: memoryData.messageList!,
      // Pass capabilities through to streamStep
      capabilities,
    };

    return loopOptions;
  };
}
