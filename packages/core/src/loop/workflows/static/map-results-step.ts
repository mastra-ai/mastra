import { z } from 'zod';
import { getModelOutputForTripwire } from '../../../agent/trip-wire';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import type { TracingContext } from '../../../observability';
import { StructuredOutputProcessor } from '../../../processors';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import { prepareMemoryStepOutputSchema } from './prepare-memory-step';
import { prepareToolsStepOutputSchema } from './prepare-tools-step';
import { executionWorkflowStateSchema } from './schema';

/**
 * Input schema for mapResultsStep - receives outputs from parallel steps
 */
const mapResultsInputSchema = z.object({
  'prepare-tools-step': prepareToolsStepOutputSchema,
  'prepare-memory-step': prepareMemoryStepOutputSchema,
});

/**
 * Creates the map results step that combines outputs from prepare steps
 * and creates the ModelLoopStreamArgs for the stream step.
 *
 * This step receives data from both prepareToolsStep and prepareMemoryStep via inputData,
 * and uses workflow state for request-specific context instead of closures.
 */
export function createMapResultsStep<OUTPUT extends OutputSchema | undefined = undefined>() {
  return createStep({
    id: 'map-results-step',
    stateSchema: executionWorkflowStateSchema,
    inputSchema: mapResultsInputSchema,
    outputSchema: z.any(), // ModelLoopStreamArgs - too complex to type
    execute: async ({
      state,
      inputData,
      bail,
      tracingContext,
    }: {
      state: z.infer<typeof executionWorkflowStateSchema>;
      inputData: z.infer<typeof mapResultsInputSchema>;
      bail: <T>(value: T) => T;
      tracingContext: TracingContext;
    }) => {
      // Extract from state (per-request context)
      const {
        capabilities,
        options,
        resourceId,
        runId,
        requestContext,
        memory,
        memoryConfig,
        saveQueueManager,
        agentSpan,
        agentId,
      } = state;

      // Extract from inputData (outputs of parallel steps)
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
        requestContext,
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
        const agentModel = await capabilities.getModel({ requestContext: result.requestContext! });

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
                requestContext: result.requestContext!,
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

      const loopOptions: ModelLoopStreamArgs<any, OUTPUT> = {
        agentId,
        requestContext: result.requestContext!,
        tracingContext: { currentSpan: agentSpan },
        runId,
        toolChoice: result.toolChoice,
        tools: result.tools,
        resourceId: result.resourceId,
        threadId: result.threadId,
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
                thread: result.thread,
                threadId: result.threadId,
                readOnlyMemory: options.memory?.readOnly,
                resourceId,
                memoryConfig,
                requestContext,
                agentSpan: agentSpan,
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
      };

      return loopOptions;
    },
  });
}
