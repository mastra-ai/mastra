import { APICallError } from '@internal/ai-sdk-v5';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import type { MastraMemory } from '../../../memory/memory';
import type { MemoryConfigInternal } from '../../../memory/types';
import { createObservabilityContext } from '../../../observability';
import type { Span, SpanType } from '../../../observability';
import { StructuredOutputProcessor } from '../../../processors';
import type { RequestContext } from '../../../request-context';
import type { Step } from '../../../workflows/step';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import type { MessageList } from '../../message-list';
import type { SaveQueueManager } from '../../save-queue';
import { getModelOutputForTripwire } from '../../trip-wire';
import type { AgentMethodType } from '../../types';
import { isSupportedLanguageModel } from '../../utils';
import { fireClientToolOutputHooks } from './client-tool-output-hooks';
import type { PrepareStreamRunScope } from './run-scope';
import {
  CONVERTED_TOOLS_KEY,
  INITIAL_SIGNAL_ECHOES_KEY,
  LOOP_OPTIONS_KEY,
  MESSAGE_LIST_KEY,
  PROCESSOR_STATES_KEY,
} from './run-scope-keys';
import type { AgentCapabilities, PrepareMemoryStepOutput, PrepareToolsStepOutput } from './schema';

/**
 * Assistant text that was already streamed to the caller when the abort happened.
 *
 * Prefers the snapshot taken when the abort signal fired. Falls back to the aborted finish
 * payload, which the stream builds from its own buffer at the abort event. Text a provider
 * emitted after cancellation is never included.
 */
function getPartialAbortedText(
  payload: { text?: string; finishReason?: string },
  streamedTextAtAbort?: string,
): string {
  if (typeof streamedTextAtAbort === 'string' && streamedTextAtAbort.length > 0) {
    return streamedTextAtAbort;
  }

  if (payload.finishReason === 'aborted' && typeof payload.text === 'string') {
    return payload.text;
  }

  return '';
}

interface MapResultsStepOptions<OUTPUT = undefined> {
  capabilities: AgentCapabilities;
  options: InnerAgentExecutionOptions<OUTPUT>;
  resourceId?: string;
  threadId?: string;
  runId: string;
  requestContext: RequestContext;
  memory?: MastraMemory;
  memoryConfig?: MemoryConfigInternal;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  agentId: string;
  agentVersionId?: string;
  methodType: AgentMethodType;
  saveQueueManager?: SaveQueueManager;
  runScope: PrepareStreamRunScope<OUTPUT>;
}

export function createMapResultsStep<OUTPUT = undefined>({
  capabilities,
  options,
  resourceId,
  threadId: threadIdFromArgs,
  runId,
  requestContext,
  memory,
  memoryConfig,
  agentSpan,
  agentId,
  agentVersionId,
  methodType,
  saveQueueManager,
  runScope,
}: MapResultsStepOptions<OUTPUT>): Step<
  string,
  unknown,
  {
    'prepare-tools-step': PrepareToolsStepOutput;
    'prepare-memory-step': PrepareMemoryStepOutput;
  },
  ModelLoopStreamArgs<any, OUTPUT>
>['execute'] {
  return async ({ inputData, bail, ..._observabilityContext }) => {
    const memoryData = inputData['prepare-memory-step'];

    // Class instances written to runScope by upstream steps. These never travel
    // through inputData because the evented engine JSON-serializes step outputs.
    const messageList = runScope.getOrThrow(MESSAGE_LIST_KEY);
    const convertedTools = runScope.get(CONVERTED_TOOLS_KEY);

    let threadCreatedByStep = false;
    const persistPartialOnAbort = options.persistPartialOnAbort === true;
    // Text already handed to the caller. Snapshotted the moment the abort signal fires so
    // chunks a provider keeps producing after cancellation can never widen the snapshot.
    let streamedText = '';
    let streamedTextAtAbort: string | undefined;

    if (persistPartialOnAbort && options.abortSignal) {
      if (options.abortSignal.aborted) {
        streamedTextAtAbort = streamedText;
      } else {
        options.abortSignal.addEventListener(
          'abort',
          () => {
            streamedTextAtAbort = streamedText;
          },
          { once: true },
        );
      }
    }

    const result = {
      ...options,
      agentId,
      agentVersionId,
      tools: convertedTools,
      runId,
      temperature: options.modelSettings?.temperature,
      toolChoice: options.toolChoice,
      thread: memoryData.thread,
      threadId: memoryData.thread?.id ?? threadIdFromArgs,
      resourceId,
      requestContext,
      messageList,
      onStepFinish: async (props: any) => {
        // When OM is enabled saving per step corrupts things because OM handles its own saving
        const shouldSavePerStep = options.savePerStep && !memoryConfig?.observationalMemory;
        if (shouldSavePerStep && !memoryConfig?.readOnly) {
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

          if (saveQueueManager && memoryData.thread?.id) {
            await saveQueueManager.flushMessages(messageList, memoryData.thread.id, memoryConfig);
          }
        }

        return options.onStepFinish?.({ ...props, runId });
      },
      ...(memoryData.tripwire && {
        tripwire: memoryData.tripwire,
      }),
    };

    // Check for tripwire and return early if triggered
    if (result.tripwire) {
      try {
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
          ...createObservabilityContext({ currentSpan: agentSpan }),
          options: options,
          model: agentModel,
          messageList,
        });

        // End agent span with tripwire information after fallback completes
        agentSpan?.end({
          output: { tripwire: memoryData.tripwire },
          attributes: {
            tripwireAbort: {
              reason: memoryData.tripwire?.reason,
              processorId: memoryData.tripwire?.processorId,
              retry: memoryData.tripwire?.retry,
              metadata: memoryData.tripwire?.metadata,
            },
          },
        });

        return bail(modelOutput);
      } catch (error) {
        // End agent span with error and tripwire context so failures aren't masked
        agentSpan?.error({
          error: error as Error,
          endSpan: true,
          attributes: {
            tripwireAbort: {
              reason: memoryData.tripwire?.reason,
              processorId: memoryData.tripwire?.processorId,
              retry: memoryData.tripwire?.retry,
              metadata: memoryData.tripwire?.metadata,
            },
          },
        });
        throw error;
      }
    }

    // Client-executed tool results arrive as trailing tool-role input messages on
    // a follow-up request (the browser ran the tool and re-invoked the agent).
    // The tool already resolved on the client, so fire `onOutput` for matching
    // execute-less tools. This runs after the tripwire check on purpose: a
    // request rejected by input processors must not trigger hook side effects.
    await fireClientToolOutputHooks({
      messages: options.messages,
      tools: convertedTools,
      abortSignal: options.abortSignal,
      logger: capabilities.logger,
    });

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
      if (capabilities.mastra) {
        structuredProcessor.__registerMastra(capabilities.mastra);
      }
      if (options.structuredOutput.useAgent) {
        structuredProcessor.setAgent(capabilities.agent);
      }
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

    const effectiveLLMRequestInputProcessors = capabilities.llmRequestInputProcessors
      ? typeof capabilities.llmRequestInputProcessors === 'function'
        ? await capabilities.llmRequestInputProcessors({
            requestContext: result.requestContext!,
            overrides: options.inputProcessors,
          })
        : options.inputProcessors || capabilities.llmRequestInputProcessors
      : effectiveInputProcessors;

    // Resolve error processors
    const effectiveErrorProcessors = capabilities.errorProcessors
      ? typeof capabilities.errorProcessors === 'function'
        ? await capabilities.errorProcessors({
            requestContext: result.requestContext!,
            overrides: options.errorProcessors,
          })
        : options.errorProcessors || capabilities.errorProcessors
      : options.errorProcessors || [];

    const modelMethodType: ModelMethodType = getModelMethodFromAgentMethod(methodType);

    const loopOptions = {
      methodType: modelMethodType,
      agentId,
      agentVersionId,
      requestContext: result.requestContext!,
      actor: options.actor,
      mcp: options.mcp,
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
      experimentalTransform: options.experimentalTransform,
      options: {
        ...(options.prepareStep && { prepareStep: options.prepareStep }),
        onFinish: async (payload: any) => {
          if (payload.finishReason === 'error') {
            const provider = payload.model?.provider;
            const modelId = payload.model?.modelId;
            const error =
              payload.error instanceof Error
                ? payload.error
                : new MastraError(
                    {
                      id: 'AGENT_STREAM_ERROR',
                      text:
                        payload.error == null
                          ? 'Agent stream finished with finishReason "error" but no error payload was provided'
                          : undefined,
                      domain: ErrorDomain.AGENT,
                      category: ErrorCategory.SYSTEM,
                      details: {
                        runId,
                        ...(provider && { provider }),
                        ...(modelId && { modelId }),
                      },
                    },
                    payload.error,
                  );
            const isUpstreamError = APICallError.isInstance(error);

            if (isUpstreamError) {
              capabilities.logger.error('Upstream LLM API error', {
                error,
                runId,
                ...(provider && { provider }),
                ...(modelId && { modelId }),
              });
            } else {
              capabilities.logger.error('Error in agent stream', {
                error,
                runId,
                ...(provider && { provider }),
                ...(modelId && { modelId }),
              });
            }

            // End the AGENT_RUN span so the trace is exported.
            // Without this, the span is orphaned and exporters that wait
            // for the root span to end (e.g. Datadog) never emit the trace.
            agentSpan?.error({ error, endSpan: true });
            return;
          }

          if (payload.finishReason === 'suspended') {
            agentSpan?.end({
              output: {
                status: 'suspended',
                reason: payload.suspendReason,
                toolName: payload.toolName,
                toolCallId: payload.toolCallId,
              },
            });
            return;
          }

          // Both abort exits share one policy: persist nothing by default, and when the caller
          // opts in persist only the assistant text that was streamed before the abort.
          const aborted = payload.finishReason === 'aborted' || options.abortSignal?.aborted === true;

          if (aborted) {
            const endAbortedSpan = () => {
              if (payload.finishReason === 'aborted') {
                agentSpan?.end({ output: { status: 'aborted', reason: 'abort' } });
              } else {
                agentSpan?.end();
              }
            };

            const partialText = getPartialAbortedText(payload, streamedTextAtAbort);

            if (!persistPartialOnAbort || partialText.trim().length === 0) {
              endAbortedSpan();
            } else {
              try {
                await capabilities.executeOnFinish({
                  // Bound the persisted response to the pre-abort snapshot. The raw payload may carry
                  // a complete post-abort response (providers can ignore cancellation).
                  result: {
                    ...payload,
                    text: partialText,
                    response: {
                      ...(payload.response ?? {}),
                      dbMessages: undefined,
                      messages: [{ role: 'assistant', content: [{ type: 'text', text: partialText }] }],
                    },
                  },
                  outputText: partialText,
                  thread: result.thread,
                  threadId: result.threadId,
                  readOnlyMemory: memoryConfig?.readOnly,
                  resourceId,
                  memoryConfig,
                  requestContext,
                  agentSpan,
                  runId,
                  messageList,
                  threadExists: memoryData.threadExists || threadCreatedByStep,
                  structuredOutput: false,
                  overrideScorers: options.scorers,
                  onTitleGenerated: options.memory?.onTitleGenerated,
                  waitUntil: options.serverless?.waitUntil,
                });

                if (saveQueueManager && result.threadId && !memoryConfig?.readOnly) {
                  await saveQueueManager.flushMessages(messageList, result.threadId, memoryConfig);
                }
              } catch (e) {
                capabilities.logger.error('Error saving partial memory on abort', {
                  error: e,
                  runId,
                });
                endAbortedSpan();
              }
            }

            // The aborted finish payload is synthetic; the caller already received onAbort.
            if (payload.finishReason === 'aborted') {
              return;
            }
          } else {
            try {
              const outputText =
                options.structuredOutput?.schema && payload.object != null
                  ? JSON.stringify(payload.object)
                  : payload.text || '';

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
                threadExists: memoryData.threadExists || threadCreatedByStep,
                structuredOutput: !!options.structuredOutput?.schema,
                overrideScorers: options.scorers,
                onTitleGenerated: options.memory?.onTitleGenerated,
                waitUntil: options.serverless?.waitUntil,
              });
            } catch (e) {
              capabilities.logger.error('Error saving memory on finish', {
                error: e,
                runId,
              });

              const spanError =
                e instanceof Error
                  ? e
                  : new MastraError(
                      {
                        id: 'AGENT_ON_FINISH_ERROR',
                        domain: ErrorDomain.AGENT,
                        category: ErrorCategory.SYSTEM,
                        details: { runId },
                      },
                      e,
                    );

              agentSpan?.error({ error: spanError, endSpan: true });
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
        onChunk: persistPartialOnAbort
          ? async (chunk: any) => {
              if (chunk.type === 'text-delta') {
                streamedText += chunk.payload.text;
              }
              await options.onChunk?.(chunk);
            }
          : options.onChunk,
        onError: options.onError,
        onAbort: options.onAbort,
        abortSignal: options.abortSignal,
      },
      activeTools: options.activeTools,
      structuredOutput: options.structuredOutput,
      inputProcessors: effectiveInputProcessors,
      llmRequestInputProcessors: effectiveLLMRequestInputProcessors,
      outputProcessors: effectiveOutputProcessors,
      errorProcessors: effectiveErrorProcessors,
      modelSettings: {
        ...(options.modelSettings || {}),
      },
      messageList,
      initialSignalEchoes: runScope.get(INITIAL_SIGNAL_ECHOES_KEY),
      maxProcessorRetries: options.maxProcessorRetries,
      // IsTaskComplete scoring for supervisor patterns
      isTaskComplete: options.isTaskComplete,
      // Native goal config (agent-level): the in-loop goal step judges the
      // thread's active objective each qualifying iteration.
      goal: capabilities.agent.__getGoalConfig(),
      // Iteration hook for supervisor patterns
      onIterationComplete: options.onIterationComplete,
      processorStates: runScope.get(PROCESSOR_STATES_KEY),
    };

    // Park the assembled (class-instance- and closure-laden) options on the
    // factory closure's runScope. stream-step reads from here; the workflow
    // engine never sees these non-JSON-safe refs in step inputs/outputs.
    runScope.set(LOOP_OPTIONS_KEY, loopOptions as ModelLoopStreamArgs<any, unknown>);

    return loopOptions;
  };
}
