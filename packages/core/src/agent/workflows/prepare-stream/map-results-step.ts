import { APICallError } from '@internal/ai-sdk-v5';
import { MastraFGAPermissions } from '../../../auth/ee';
import type { MastraFGAPermissionInput } from '../../../auth/ee';
import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import { getModelMethodFromAgentMethod } from '../../../llm/model/model-method-from-agent';
import type { ModelLoopStreamArgs, ModelMethodType } from '../../../llm/model/model.loop.types';
import { isMastraTimeoutError } from '../../../loop/timeout';
import type { MastraMemory } from '../../../memory/memory';
import { normalizeMessageHistoryConfig } from '../../../memory/message-history-config';
import { isObservationalMemoryEnabled } from '../../../memory/types';
import type { MemoryConfigInternal } from '../../../memory/types';
import { createObservabilityContext } from '../../../observability';
import type { Span, SpanType } from '../../../observability';
import { StructuredOutputProcessor } from '../../../processors';
import type { OutputProcessorOrWorkflow } from '../../../processors';
import { isProcessorWorkflow } from '../../../processors/is-processor-workflow';
import type { RequestContext } from '../../../request-context';
import type { MastraOnFinishCallbackContext } from '../../../stream/types';
import type { Step } from '../../../workflows/step';
import type { InnerAgentExecutionOptions } from '../../agent.types';
import { filterMessagesForPersistence } from '../../filter-messages-for-persistence';
import type { MastraDBMessage, MessageList } from '../../message-list';
import type { SaveQueueManager } from '../../save-queue';
import { undoSavedResponseMessages } from '../../save-queue/undo-saved-response-messages';
import { getModelOutputForTripwire } from '../../trip-wire';
import type { AgentMethodType } from '../../types';
import { isSupportedLanguageModel } from '../../utils';
import { applyClientToolModelOutput, fireClientToolOutputHooks } from './client-tool-output-hooks';
import type { PrepareStreamRunScope } from './run-scope';
import {
  CONVERTED_TOOLS_KEY,
  INITIAL_SIGNAL_ECHOES_KEY,
  LOOP_OPTIONS_KEY,
  MESSAGE_LIST_KEY,
  PROCESSOR_STATES_KEY,
} from './run-scope-keys';
import type { AgentCapabilities, PrepareMemoryStepOutput, PrepareToolsStepOutput } from './schema';

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
  resolvedScopes?: string[];
  methodType: AgentMethodType;
  saveQueueManager?: SaveQueueManager;
  authorizeMemory: (permission: MastraFGAPermissionInput, threadId: string) => Promise<void>;
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
  resolvedScopes,
  methodType,
  saveQueueManager,
  authorizeMemory,
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
  return async ({ inputData, bail }) => {
    const memoryData = inputData['prepare-memory-step'];

    // Class instances written to runScope by upstream steps. These never travel
    // through inputData because the evented engine JSON-serializes step outputs.
    const messageList = runScope.getOrThrow(MESSAGE_LIST_KEY);
    const convertedTools = runScope.get(CONVERTED_TOOLS_KEY);

    let threadCreatedByStep = false;

    // Output only ever merges into the latest message, so that is the only earlier-turn message
    // snapshotted for undoSavedResponseMessages, after client tool output mapping has enriched it.
    let earlierTurnSnapshot: MastraDBMessage | undefined;

    const ensureThreadExists = async () => {
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
    };

    // Configured output processors as resolved for this run, captured before execution so the
    // total-timeout save sees the same selection the run used.
    let configuredOutputProcessors: OutputProcessorOrWorkflow[] = [];

    const saveInputAfterTotalTimeout = async () => {
      if (!memory || !memoryData.thread?.id) return;
      // Mirror the finish path: only a MessageHistory output processor saves the turn. An explicitly
      // configured one always runs; memory adds one only when history is enabled and observational
      // memory does not own the writes (see Memory.getOutputProcessors).
      const effectiveConfig = memory.getMergedThreadConfig(memoryConfig);
      if (effectiveConfig.readOnly) return;
      const hasConfiguredProcessor = (id: string) =>
        configuredOutputProcessors.some(p => !isProcessorWorkflow(p) && p.id === id);
      const memoryAddsMessageHistory =
        normalizeMessageHistoryConfig(effectiveConfig.lastMessages, effectiveConfig.messageHistory).enabled &&
        !hasConfiguredProcessor('observational-memory') &&
        !isObservationalMemoryEnabled(effectiveConfig.observationalMemory);
      if (!hasConfiguredProcessor('message-history') && !memoryAddsMessageHistory) return;
      const input = filterMessagesForPersistence(messageList.get.input.db());
      if (input.length === 0) return;

      await authorizeMemory(MastraFGAPermissions.MEMORY_WRITE, memoryData.thread.id);
      await ensureThreadExists();
      await memory.saveMessages({ messages: messageList.transformMessagesForTranscript(input), memoryConfig });
    };

    const result = {
      ...options,
      agentId,
      agentVersionId,
      resolvedScopes,
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
          if (memoryData.thread?.id) {
            await authorizeMemory(MastraFGAPermissions.MEMORY_WRITE, memoryData.thread.id);
          }
          await ensureThreadExists();

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

        // End the whole tree with tripwire information; descendants close
        // without inheriting the terminal output
        agentSpan?.end({
          endTree: true,
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
        // Record the error with tripwire context so failures aren't masked,
        // then end the whole span tree. Rejections are not guaranteed to be
        // Error instances; MastraError extracts a usable message from any
        // cause shape.
        const spanError =
          error instanceof Error
            ? error
            : new MastraError(
                {
                  id: 'AGENT_TRIPWIRE_FALLBACK_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.SYSTEM,
                  details: { runId },
                },
                error,
              );
        agentSpan?.error({
          error: spanError,
          endTree: true,
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

    // Apply server-defined toModelOutput to those same client-executed results.
    // This enriches the ingested MessageList parts (not options.messages — the
    // list converted its own copies in prepare-memory) so prompt conversion
    // restores the mapped output.
    await applyClientToolModelOutput({
      messageList,
      tools: convertedTools,
      logger: capabilities.logger,
    });

    const latestMessage = messageList.get.all.db().at(-1);
    earlierTurnSnapshot = latestMessage?.role === 'assistant' ? structuredClone(latestMessage) : undefined;

    // The total-timeout save needs the configured processors. Resolve them once
    // and pass them on as overrides so a function-form resolver runs only once.
    let outputProcessorOverrides = options.outputProcessors;
    if (memory && memoryData.thread?.id && options.modelSettings?.timeout?.totalMs) {
      configuredOutputProcessors =
        options.outputProcessors ?? (await capabilities.agent.listConfiguredOutputProcessors(result.requestContext));
      outputProcessorOverrides = configuredOutputProcessors;
    }

    // Resolve output processors - overrides replace user-configured but auto-derived (memory) are kept
    let effectiveOutputProcessors = capabilities.outputProcessors
      ? typeof capabilities.outputProcessors === 'function'
        ? await capabilities.outputProcessors({
            requestContext: result.requestContext!,
            overrides: outputProcessorOverrides,
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

    // Resolve error processors once per run. The request lane below reuses this list, so a
    // dynamic resolver runs a single time and both lanes share the same instances.
    // `hasConfiguredErrorProcessors` reports whether the caller configured error processors
    // themselves (constructor or call-time), excluding the framework's default stability
    // processors. It gates the implicit retry-cap warning in resolveMaxProcessorRetries — the
    // defaults self-limit, so warning about them is noise on every bare agent.
    const { errorProcessors: effectiveErrorProcessors, hasConfiguredErrorProcessors } = capabilities.errorProcessors
      ? typeof capabilities.errorProcessors === 'function'
        ? await capabilities.errorProcessors({
            requestContext: result.requestContext!,
            overrides: options.errorProcessors,
          })
        : {
            errorProcessors: options.errorProcessors || capabilities.errorProcessors,
            hasConfiguredErrorProcessors: (options.errorProcessors || capabilities.errorProcessors).length > 0,
          }
      : {
          errorProcessors: options.errorProcessors || [],
          hasConfiguredErrorProcessors: !!options.errorProcessors?.length,
        };

    const effectiveLLMRequestInputProcessors = capabilities.llmRequestInputProcessors
      ? typeof capabilities.llmRequestInputProcessors === 'function'
        ? await capabilities.llmRequestInputProcessors({
            requestContext: result.requestContext!,
            overrides: options.inputProcessors,
            errorOverrides: effectiveErrorProcessors,
          })
        : options.inputProcessors || capabilities.llmRequestInputProcessors
      : effectiveInputProcessors;

    const modelMethodType: ModelMethodType = getModelMethodFromAgentMethod(methodType);

    const loopOptions = {
      methodType: modelMethodType,
      agentId,
      agentVersionId,
      resolvedScopes,
      requestContext: result.requestContext!,
      actor: options.actor,
      mcp: options.mcp,
      ...createObservabilityContext({ currentSpan: agentSpan }),
      agentRunSpan: agentSpan,
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
      hideSignals: options.hideSignals,
      options: {
        ...(options.prepareStep && { prepareStep: options.prepareStep }),
        onFinish: async (payload: any, context?: MastraOnFinishCallbackContext) => {
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

            // Record the error, then end the whole span tree. Ending only the
            // root would orphan still-open descendants, and exporters that wait
            // for every span to finish (e.g. Datadog) retain the trace forever.
            agentSpan?.error({ error, endTree: true });
            return;
          }

          if (payload.finishReason === 'suspended') {
            capabilities.onRunSuspended?.();
            agentSpan?.end({
              endTree: true,
              output: {
                status: 'suspended',
                reason: payload.suspendReason,
                toolName: payload.toolName,
                toolCallId: payload.toolCallId,
              },
            });
            return;
          }

          const aborted = payload.finishReason === 'aborted' || options.abortSignal?.aborted === true;

          if (aborted) {
            if (payload.finishReason === 'aborted') {
              agentSpan?.end({ endTree: true, output: { status: 'aborted', reason: 'abort' } });
              // The aborted finish payload is synthetic; the caller already received onAbort.
              return;
            }

            agentSpan?.end({ endTree: true });
          } else {
            if (context?.outputResultTripwire) {
              await undoSavedResponseMessages({
                memory,
                threadId: memoryData.thread?.id ?? threadIdFromArgs,
                memoryConfig,
                messageList,
                saveQueueManager,
                earlierTurnSnapshot,
                logger: capabilities.logger,
                runId,
              });
            }

            try {
              const outputText =
                options.structuredOutput?.schema && payload.object != null
                  ? JSON.stringify(payload.object)
                  : payload.text || '';

              if (!memoryConfig?.readOnly && result.threadId) {
                await authorizeMemory(MastraFGAPermissions.MEMORY_WRITE, result.threadId);
              }
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
                // Only streaming runs can deliver a `data-thread-title` chunk; `generate()` returns JSON.
                writer: modelMethodType === 'stream' ? context?.writer : undefined,
                abortSignal: options.abortSignal,
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

              agentSpan?.error({ error: spanError, endTree: true });
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
        onError: async ({ error }: { error: Error | string }) => {
          // A run that hits `timeout.totalMs` ends without a `finish` chunk, so the output
          // processors that normally persist the turn never run. Save the accepted user
          // message; completed steps are only saved by `savePerStep`, and the unfinished
          // step is never saved after the deadline.
          if (isMastraTimeoutError(error) && error.timeoutType === 'total') {
            try {
              await saveInputAfterTotalTimeout();
            } catch (e) {
              capabilities.logger.error('Error saving memory after total timeout', { error: e, runId });
            }
          }
          await options.onError?.({ error });
        },
        onAbort: options.onAbort,
        abortSignal: options.abortSignal,
      },
      activeTools: options.activeTools,
      structuredOutput: options.structuredOutput,
      inputProcessors: effectiveInputProcessors,
      llmRequestInputProcessors: effectiveLLMRequestInputProcessors,
      outputProcessors: effectiveOutputProcessors,
      errorProcessors: effectiveErrorProcessors,
      hasConfiguredErrorProcessors,
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
      agent: capabilities.agent,
    };

    // Park the assembled (class-instance- and closure-laden) options on the
    // factory closure's runScope. stream-step reads from here; the workflow
    // engine never sees these non-JSON-safe refs in step inputs/outputs.
    runScope.set(LOOP_OPTIONS_KEY, loopOptions as ModelLoopStreamArgs<any, unknown>);

    return loopOptions;
  };
}
