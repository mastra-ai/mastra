import { APICallError } from '@internal/ai-sdk-v5';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfig } from '../../../memory/types';
import { resolveObservabilityContext, createObservabilityContext } from '../../../observability';
import type { Span, SpanType } from '../../../observability';
import { StructuredOutputProcessor } from '../../../processors';
import type { RequestContext } from '../../../request-context';
import type { Step } from '../../../workflows';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import { getModelOutputForTripwire } from '../../trip-wire';
import type { AgentMethodType } from '../../types';
import { isSupportedLanguageModel } from '../../utils';
import type { AgentCapabilities, PrepareMemoryStepOutput, PrepareToolsStepOutput } from './schema';

interface MapResultsStepOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT>;
  resourceId?: string;
  runId: string;
  requestContext: RequestContext;
  memory?: MastraMemory;
  memoryConfig?: MemoryConfig;
  agentSpan: Span<SpanType.AGENT_RUN>;
  agentId: string;
  methodType: AgentMethodType;
  /**
   * Shared processor state map that persists across agent turns.
   */
  processorStates?: Map<string, Record<string, unknown>>;
}

export function createMapResultsStep<OUTPUT = undefined>({
  capabilities,
  options,
  resourceId,
  runId,
  requestContext,
  memory,
  memoryConfig,
  agentSpan,
  agentId,
  methodType,
}: MapResultsStepOptions<OUTPUT>): Step<
  string,
  unknown,
  {
    'prepare-tools-step': PrepareToolsStepOutput;
    'prepare-memory-step': PrepareMemoryStepOutput;
  },
  ModelLoopStreamArgs<any, OUTPUT>
>['execute'] {
  return async ({ inputData, bail, ...observabilityContext }) => {
    const toolsData = inputData['prepare-tools-step'];
    const memoryData = inputData['prepare-memory-step'];

    let threadCreatedByStep = false;

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
        if (options.savePerStep && !memoryConfig?.readOnly) {
          if (!memoryData.threadExists && !threadCreatedByStep && memory && memoryData.thread) {
            await memory.createThread({
              threadId: memoryData.thread?.id,
              title: memoryData.thread?.title,
              metadata: memoryData.thread?.metadata,
              resourceId: memoryData.thread?.resourceId,
              memoryConfig,
            });

            threadCreatedByStep = true;
          }

          await capabilities.saveStepMessages({
            result: props,
            messageList: memoryData.messageList!,
            runId,
          });
        }

        return options.onStepFinish?.({ ...props, runId });
      },
      ...(memoryData.tripwire && {
        tripwire: memoryData.tripwire,
      }),
    };

    // Check for tripwire and return early if triggered
    if (result.tripwire) {
      const agentModel = await capabilities.getModel({ requestContext: result.requestContext! });

      if (!isSupportedLanguageModel(agentModel)) {
        throw new MastraError({
          id: 'MAP_RESULTS_STEP_UNSUPPORTED_MODEL',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'Tripwire handling requires a v2/v3 model',
        });
      }

      const modelOutput = await getModelOutputForTripwire<OUTPUT>({
        tripwire: memoryData.tripwire!,
        runId,
        ...resolveObservabilityContext(observabilityContext),
        options: options,
        model: agentModel,
        messageList: memoryData.messageList,
      });

      return bail(modelOutput);
    }

    // Resolve output processors - overrides replace user-configured but auto-derived (memory) are kept
    let effectiveOutputProcessors = capabilities.outputProcessors
      ? typeof capabilities.outputProcessors === 'function'
        ? await capabilities.outputProcessors({
            requestContext: result.requestContext!,
            overrides: options.outputProcessors,
          })
        : options.outputProcessors || capabilities.outputProcessors
      : options.outputProcessors || [];

    // Handle structuredOutput option by creating an StructuredOutputProcessor
    // Only create the processor if a model is explicitly provided
    if (options.structuredOutput?.model) {
      const structuredProcessor = new StructuredOutputProcessor({
        ...options.structuredOutput,
        logger: capabilities.logger,
      });
      effectiveOutputProcessors = effectiveOutputProcessors
        ? [...effectiveOutputProcessors, structuredProcessor]
        : [structuredProcessor];
    }

    // Resolve input processors - overrides replace user-configured but auto-derived (memory, skills) are kept
    const effectiveInputProcessors = capabilities.inputProcessors
      ? typeof capabilities.inputProcessors === 'function'
        ? await capabilities.inputProcessors({
            requestContext: result.requestContext!,
            overrides: options.inputProcessors,
          })
        : options.inputProcessors || capabilities.inputProcessors
      : options.inputProcessors || [];

    const messageList = memoryData.messageList!;

    const modelMethodType: ModelMethodType = getModelMethodFromAgentMethod(methodType);

    const loopOptions = {
      methodType: modelMethodType,
      agentId,
      requestContext: result.requestContext!,
      ...createObservabilityContext({ currentSpan: agentSpan }),
      runId,
      toolChoice: result.toolChoice,
      tools: result.tools,
      resourceId: result.resourceId,
      threadId: result.threadId,
      stopWhen: result.stopWhen,
      maxSteps: result.maxSteps,
      providerOptions: result.providerOptions,
      includeRawChunks: options.includeRawChunks,
      options: {
        ...(options.prepareStep && { prepareStep: options.prepareStep }),
        onFinish: async (payload: any) => {
          if (payload.finishReason === 'error') {
            const provider = payload.model?.provider;
            const modelId = payload.model?.modelId;
            const isUpstreamError = APICallError.isInstance(payload.error);

            if (isUpstreamError) {
              const providerInfo = provider ? ` from ${provider}` : '';
              const modelInfo = modelId ? ` (model: ${modelId})` : '';
              capabilities.logger.error(`Upstream LLM API error${providerInfo}${modelInfo}`, {
                error: payload.error,
                runId,
                ...(provider && { provider }),
                ...(modelId && { modelId }),
              });
            } else {
              capabilities.logger.error('Error in agent stream', {
                error: payload.error,
                runId,
                ...(provider && { provider }),
                ...(modelId && { modelId }),
              });
            }
            return;
          }

          // Skip memory persistence when the abort signal has fired.
          // The LLM response may have continued after the caller disconnected,
          // and we should not persist a partial or full response for an aborted request.
          const aborted = options.abortSignal?.aborted;

          if (!aborted) {
            try {
              const outputText = messageList.get.all
                .core()
                .map(m => m.content)
                .join('\n');

              await capabilities.executeOnFinish({
                result: payload,
                outputText,
                thread: result.thread,
                threadId: result.threadId,
                readOnlyMemory: memoryConfig?.readOnly,
                resourceId,
                memoryConfig,
                requestContext,
                agentSpan: agentSpan,
                runId,
                messageList,
                threadExists: memoryData.threadExists,
                structuredOutput: !!options.structuredOutput?.schema,
                overrideScorers: options.scorers,
              });
            } catch (e) {
              capabilities.logger.error('Error saving memory on finish', {
                error: e,
                runId,
              });
            }
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
        abortSignal: options.abortSignal,
      },
      activeTools: options.activeTools,
      structuredOutput: options.structuredOutput,
      inputProcessors: effectiveInputProcessors,
      outputProcessors: effectiveOutputProcessors,
      modelSettings: {
        temperature: 0,
        ...(options.modelSettings || {}),
      },
      messageList: memoryData.messageList!,
      maxProcessorRetries: options.maxProcessorRetries,
      // IsTaskComplete scoring for supervisor patterns
      isTaskComplete: options.isTaskComplete,
      // Iteration hook for supervisor patterns
      onIterationComplete: options.onIterationComplete,
      processorStates: memoryData.processorStates,
    };

    return loopOptions;
  };
}
