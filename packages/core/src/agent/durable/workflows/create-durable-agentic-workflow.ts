import { z } from 'zod';
import type { MastraScorer, MastraScorerEntry } from '../../../evals/base';
import { runScorer } from '../../../evals/hooks';
import type { PubSub } from '../../../events/pubsub';
import type { Mastra } from '../../../mastra';
import { createObservabilityContext, InternalSpans } from '../../../observability';
import type { AIModelGenerationSpan, ExportedSpan, SpanType } from '../../../observability';
import { RequestContext } from '../../../request-context';
import { PUBSUB_SYMBOL } from '../../../workflows/constants';
import { createWorkflow } from '../../../workflows/create';
import { MessageList } from '../../message-list';
import { DurableStepIds, DurableAgentDefaults } from '../constants';
import { globalRunRegistry } from '../run-registry';
import { emitFinishEvent, emitIterationCompleteEvent } from '../stream-adapter';
import type {
  DurableToolCallInput,
  DurableAgenticWorkflowInput,
  DurableAgenticExecutionOutput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
  SerializableScorersConfig,
} from '../types';
import {
  modelConfigSchema,
  modelListEntrySchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
} from './shared';
import {
  createDurableBackgroundTaskCheckStep,
  createDurableGoalStep,
  createDurableIsTaskCompleteStep,
  createDurableLLMExecutionStep,
  createDurableToolCallStep,
  createDurableLLMMappingStep,
} from './steps';

/**
 * Options for creating a durable agentic workflow
 */
export interface DurableAgenticWorkflowOptions {
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
}

/**
 * Input schema for the durable agentic workflow.
 * Extends base schema with model list for fallback support.
 */
const durableAgenticInputSchema = z.object({
  __workflowKind: z.literal('durable-agent'),
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  // Model list for fallback support (when agent configured with array of models)
  modelList: z.array(modelListEntrySchema).optional(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // Exported AGENT_RUN / MODEL_GENERATION span data, threaded so the run shares one trace
  agentSpanData: z.any().optional(),
  modelSpanData: z.any().optional(),
  // JSON-safe snapshot of requestContext.entries() so durable steps can read
  // it (e.g. is-task-complete scorers pass it as customContext).
  requestContextEntries: z.record(z.string(), z.any()).optional(),
});

// Re-export shared output schema (identical across implementations)
// Note: durableAgenticOutputSchema is imported from shared

/**
 * Schema for the iteration state that flows through the dowhile loop.
 * Extends base schema with model list for fallback support.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
  // Model list for fallback support
  modelList: z.array(z.any()).optional(),
});

type IterationState = z.infer<typeof iterationStateSchema>;

/**
 * Create a durable agentic workflow.
 *
 * This workflow implements the agentic loop pattern in a durable way:
 *
 * 1. LLM Execution Step - Calls the LLM and gets response/tool calls
 * 2. Tool Call Steps (foreach) - Executes each tool call in parallel
 * 3. LLM Mapping Step - Merges tool results back into state
 * 4. Loop - Continues if more tool calls are needed (dowhile)
 *
 * All state flows through workflow input/output, making it durable across
 * process restarts and execution engine replays.
 */
export function createDurableAgenticWorkflow(options?: DurableAgenticWorkflowOptions) {
  const maxSteps = options?.maxSteps ?? DurableAgentDefaults.MAX_STEPS;

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the tool call step - each tool call runs as its own step with suspend support
  const toolCallStep = createDurableToolCallStep();

  // Create the LLM mapping step
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the background task check step
  const backgroundTaskCheckStep = createDurableBackgroundTaskCheckStep();

  // Create the isTaskComplete evaluation step (mirrors the non-durable
  // createIsTaskCompleteStep). Lives as a real step (not predicate logic)
  // so it shows up in workflow traces and produces a proper state transition.
  const isTaskCompleteStep = createDurableIsTaskCompleteStep(maxSteps);

  // Create the goal evaluation step — mirrors the non-durable
  // `createGoalStep`. Runs after isTaskComplete so the goal judge
  // sees whether isTaskComplete already stopped the loop.
  const goalStep = createDurableGoalStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  // Note: foreach runs with concurrency: 1 (sequential) because tool approval
  // and suspension require sequential execution to properly handle suspend/resume.
  // The workflow is created once at startup and reused for all runs.
  const singleIterationWorkflow = createWorkflow({
    id: DurableStepIds.AGENTIC_EXECUTION,
    inputSchema: iterationStateSchema,
    outputSchema: iterationStateSchema,
    options: {
      shouldPersistSnapshot: params => {
        // We need a persisted snapshot record to support `resumeStream()`.
        // - Create the initial record early ("pending")
        // - Update it when execution is suspended ("paused"/"suspended")
        // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
        return (
          params.workflowStatus === 'pending' ||
          params.workflowStatus === 'paused' ||
          params.workflowStatus === 'suspended'
        );
      },
      validateInputs: false,
      sharePubsub: true,
      // Internal durable-agent execution plumbing — hide workflow spans;
      // the agent/tool/model spans within still surface for users.
      tracingPolicy: {
        internal: InternalSpans.WORKFLOW,
      },
    },
  })
    // Step 0: Convert iteration state to LLM input format
    .map(
      async ({ inputData }) => {
        const state = inputData as IterationState;
        return {
          runId: state.runId,
          agentId: state.agentId,
          agentName: state.agentName,
          messageListState: state.messageListState,
          toolsMetadata: state.toolsMetadata,
          modelConfig: state.modelConfig,
          modelList: state.modelList,
          options: state.options,
          state: state.state,
          messageId: state.messageId,
          stepIndex: state.iterationCount,
          agentSpanData: state.agentSpanData,
          modelSpanData: state.modelSpanData,
        };
      },
      { id: 'map-to-llm-input' },
    )
    // Step 1: Execute LLM
    .then(llmExecutionStep)
    // Step 2: Extract tool calls as array for foreach (forward model_step span for nesting)
    .map(
      async ({ inputData }) => {
        const llmOutput = inputData as DurableLLMStepOutput;
        return (llmOutput.toolCalls ?? []).map(toolCall => ({
          ...toolCall,
          stepSpanData: llmOutput.stepSpanData,
        })) as DurableToolCallInput[];
      },
      { id: 'extract-tool-calls' },
    )
    // Step 3: Execute each tool call individually (with suspend support)
    .foreach(toolCallStep)
    // Step 4: Collect tool results and bundle with LLM output for mapping step
    .map(
      async ({ inputData, getStepResult, getInitData }) => {
        const toolResults = inputData as DurableToolCallOutput[];
        const llmOutput = getStepResult(llmExecutionStep.id) as DurableLLMStepOutput;
        const initData = getInitData() as IterationState;

        return {
          llmOutput,
          toolResults,
          runId: initData.runId,
          agentId: initData.agentId,
          messageId: initData.messageId,
          state: llmOutput?.state ?? initData.state,
        };
      },
      { id: 'collect-tool-results' },
    )
    // Step 5: Map tool results back to state
    .then(llmMappingStep)
    // Step 6: Check for pending background tasks
    .then(backgroundTaskCheckStep)
    // Step 7: Map back to iteration state format using shared function
    .map(
      async ({ inputData, getInitData }) => {
        const executionOutput = inputData as DurableAgenticExecutionOutput;
        const initData = getInitData() as IterationState;

        // Use shared function for base state update
        const baseUpdate = createBaseIterationStateUpdate({
          currentState: initData,
          executionOutput,
        });

        // Extend with core-specific fields
        const newIterationState: IterationState = {
          ...baseUpdate,
          modelList: initData.modelList,
        };

        return newIterationState;
      },
      { id: 'update-iteration-state' },
    )
    // Step 8: Evaluate user-supplied isTaskComplete scorers (if any). Runs as
    // a real step so it shows up in traces and may mutate lastStepResult /
    // messageListState before the dowhile predicate decides whether to loop
    // again. No-op when the run has no policy configured.
    .then(isTaskCompleteStep)
    // Step 9: Goal evaluation. Mirrors the non-durable createGoalStep — judges
    // whether the thread's active objective is satisfied or should continue.
    // No-op when no goal is configured or no active objective exists.
    .then(goalStep)
    .commit();

  // Create the main agentic loop workflow with dowhile
  return (
    createWorkflow({
      id: DurableStepIds.AGENTIC_LOOP,
      inputSchema: durableAgenticInputSchema,
      outputSchema: durableAgenticOutputSchema,
      options: {
        shouldPersistSnapshot: params => {
          // We need a persisted snapshot record to support `resumeStream()`.
          // - Create the initial record early ("pending")
          // - Update it when execution is suspended ("paused"/"suspended")
          // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
          return (
            params.workflowStatus === 'pending' ||
            params.workflowStatus === 'paused' ||
            params.workflowStatus === 'suspended'
          );
        },
        validateInputs: false,
        // Internal durable-agent execution plumbing — see singleIterationWorkflow.
        tracingPolicy: {
          internal: InternalSpans.WORKFLOW,
        },
      },
    })
      // Initialize iteration state from input
      .map(
        async ({ inputData }) => {
          const input = inputData as DurableAgenticWorkflowInput;
          const iterationState: IterationState = {
            ...input,
            iterationCount: 0,
            accumulatedSteps: [],
            accumulatedUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            lastStepResult: undefined,
          };
          return iterationState;
        },
        { id: 'init-iteration-state' },
      )
      // Run the agentic loop with dowhile
      .dowhile(singleIterationWorkflow, async params => {
        const { inputData, mastra } = params;
        const state = inputData as IterationState;
        const initData = params.getInitData() as DurableAgenticWorkflowInput;
        const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
        const registryEntry = globalRunRegistry.get(state.runId);

        // Two-phase stop: if onIterationComplete returned { continue: false, feedback }
        // on the previous iteration, we allowed one more LLM turn with that feedback.
        // Now that the turn has completed, stop the loop unconditionally.
        let hasFinishedSteps = false;
        // Hard-stop tracks reasons that onIterationComplete must NOT override.
        // pendingFeedbackStop and delegationBailed are unconditional stops.
        let hardStop = false;
        if (state.pendingFeedbackStop) {
          hasFinishedSteps = true;
          hardStop = true;
          state.pendingFeedbackStop = false;
        }

        // Continuation check. isTaskComplete (when configured) runs as a
        // proper step inside singleIterationWorkflow and may have already
        // flipped lastStepResult.isContinued by the time we get here.
        const shouldContinue = state.lastStepResult?.isContinued === true;
        const runMaxSteps = state.options?.maxSteps ?? maxSteps;
        const underMaxSteps = state.iterationCount < runMaxSteps;

        // Evaluate user-supplied stopWhen predicate(s) parked on the registry
        // up-front so we can include them in the finality decision emitted on
        // the iteration-complete event. The predicate is a closure and can't
        // survive the wire, so we read it from in-process state. Cross-process
        // engines (Inngest after worker restart) won't have the registry entry
        // and fall back to maxSteps only.
        let stopWhenMatched = false;
        if (shouldContinue && underMaxSteps && !hasFinishedSteps) {
          const stopWhen = registryEntry?.stopWhen;
          if (stopWhen && state.accumulatedSteps.length > 0) {
            const conditions = Array.isArray(stopWhen) ? stopWhen : [stopWhen];
            // Mirror agentic-loop: cast steps to any for v5/v6 StopCondition shape
            // compatibility — the StepRecord we accumulate is sufficient at runtime.
            const steps = state.accumulatedSteps as any;
            const results = await Promise.all(conditions.map(condition => condition({ steps })));
            stopWhenMatched = results.some(Boolean);
          }
        }

        if (stopWhenMatched) {
          hasFinishedSteps = true;
        }

        // Check if a delegation hook called ctx.bail() during this iteration.
        // The flag was set by the mapping step and propagated via iteration state.
        const delegationBailed = !!(state as any).delegationBailed;
        if (delegationBailed) {
          hasFinishedSteps = true;
          hardStop = true;
          // Reset the flag so it doesn't carry forward
          (state as any).delegationBailed = false;
        }

        let isFinal = !shouldContinue || !underMaxSteps || hasFinishedSteps;

        // Call onIterationComplete hook if provided (for every iteration, not
        // just continued ones). Mirrors the regular agentic-loop predicate:
        // the handler can return { continue: false } to stop, { continue: true }
        // to force-continue (if under maxSteps), and/or { feedback } to inject
        // a message before the next turn.
        const onIterationComplete = registryEntry?.onIterationComplete;
        if (onIterationComplete && !state.backgroundTaskPending) {
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];

          try {
            // Deserialize messageList for the callback's messages snapshot
            const callbackMessageList = new MessageList();
            try {
              callbackMessageList.deserialize(state.messageListState);
            } catch {
              // If deserialization fails, callback sees empty messages
            }

            const iterationContext = {
              iteration: state.accumulatedSteps.length,
              maxIterations: runMaxSteps,
              text: lastStep?.text ?? '',
              toolCalls: (lastStep?.toolCalls ?? []).map((tc: any) => ({
                id: tc.toolCallId || tc.id || '',
                name: tc.toolName || tc.name || '',
                args: (tc.args || {}) as Record<string, unknown>,
              })),
              toolResults: (lastStep?.toolResults ?? []).map((tr: any) => ({
                id: tr.toolCallId || tr.id || '',
                name: tr.toolName || tr.name || '',
                result: tr.result,
                error: tr.error,
              })),
              isFinal,
              finishReason: lastStep?.finishReason ?? 'unknown',
              runId: state.runId,
              threadId: initData.state?.threadId,
              resourceId: initData.state?.resourceId,
              agentId: state.agentId,
              agentName: state.agentName ?? state.agentId,
              messages: callbackMessageList.get.all.db(),
            };

            const iterationResult = await onIterationComplete(iterationContext);

            if (iterationResult) {
              // Determine whether we can run another turn. Hard stops
              // (pendingFeedbackStop, delegationBailed) are unconditional —
              // onIterationComplete cannot override them.
              const canRunAnotherTurn =
                !hardStop && underMaxSteps && (shouldContinue || iterationResult.continue === true);

              if (iterationResult.feedback && canRunAnotherTurn) {
                // Inject feedback as a synthetic assistant message so the LLM
                // sees it on the next turn. Mirror the regular agent: mark it
                // with completionResult.suppressFeedback so isTaskComplete
                // scorers skip it.
                const feedbackId =
                  (mastra as Mastra | undefined)?.generateId?.() ??
                  globalThis.crypto?.randomUUID?.() ??
                  `msg_${Date.now()}`;
                callbackMessageList.add(
                  {
                    id: feedbackId,
                    createdAt: new Date(),
                    type: 'text',
                    role: 'assistant',
                    content: {
                      parts: [{ type: 'text', text: iterationResult.feedback }],
                      metadata: {
                        mode: 'stream',
                        completionResult: { suppressFeedback: true },
                      },
                      format: 2,
                    },
                  } as any,
                  'response',
                );
                // Re-serialize the updated messageList
                state.messageListState = callbackMessageList.serialize();

                if (iterationResult.continue === false) {
                  // Two-phase stop: let one more LLM turn run with the feedback,
                  // then stop on the next predicate evaluation.
                  state.pendingFeedbackStop = true;
                  isFinal = false;
                } else if (!hasFinishedSteps && underMaxSteps) {
                  isFinal = false;
                  if (state.lastStepResult) {
                    state.lastStepResult.isContinued = true;
                  }
                }
              } else if (iterationResult.continue === false && !hasFinishedSteps) {
                hasFinishedSteps = true;
                isFinal = true;
              } else if (iterationResult.continue === true && !hardStop && (hasFinishedSteps || !shouldContinue)) {
                if (underMaxSteps || !runMaxSteps) {
                  hasFinishedSteps = false;
                  isFinal = false;
                  if (state.lastStepResult) {
                    state.lastStepResult.isContinued = true;
                  }
                }
              }
            }
          } catch (error) {
            // Log error but don't fail the iteration
            const logger = (mastra as Mastra | undefined)?.getLogger?.();
            logger?.error('Error in onIterationComplete hook:', error);
          }
        }

        // Rotate messageId for the next iteration. Each iteration's assistant
        // response is a distinct message, mirroring the non-durable agentic
        // loop which calls rotateResponseMessageId() between iterations. The
        // mutated state.messageId flows into the next singleIterationWorkflow
        // input via map-to-llm-input.
        //
        // We also mark the current MessageList's last assistant message as a
        // response boundary so MessageMerger won't collapse the next
        // iteration's assistant content into it. Without this, persisted
        // memory keeps a single assistant message and the rotated id is never
        // observable to consumers.
        if (!isFinal) {
          const nextMessageId =
            (mastra as Mastra | undefined)?.generateId?.() ?? globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}`;
          state.messageId = nextMessageId;

          try {
            const boundaryList = new MessageList();
            boundaryList.deserialize(state.messageListState);
            boundaryList.markResponseMessageBoundary();
            state.messageListState = boundaryList.serialize();
          } catch {
            // Boundary marking is best-effort; if deserialization fails the
            // next iteration will still run with the un-marked state.
          }
        }

        // Emit an iteration-complete event for observability. This fires after
        // every iteration (including the last one) so client-side callbacks
        // (via stream-adapter) can track progress. The in-process callback
        // above has already been evaluated and its result applied to the
        // continuation decision.
        if (pubsub) {
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          await emitIterationCompleteEvent(pubsub, state.runId, {
            iteration: state.iterationCount,
            maxIterations: runMaxSteps,
            text: lastStep?.text,
            toolCalls: lastStep?.toolCalls,
            toolResults: lastStep?.toolResults,
            isFinal,
            finishReason: lastStep?.finishReason,
            runId: state.runId,
            threadId: initData.state?.threadId,
            resourceId: initData.state?.resourceId,
            agentId: initData.agentId,
            agentName: initData.agentName,
          });
        }

        return !isFinal;
      })
      // Map final state to output format, run output processors, persist memory, emit finish
      .map(
        async params => {
          const { inputData, mastra, requestContext, tracingContext } = params;
          const state = inputData as IterationState;
          const initData = params.getInitData() as DurableAgenticWorkflowInput;

          const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
          const logger = mastra?.getLogger?.();

          // Extract final text from last step
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          const finalText = lastStep?.text;

          // Run output processors (processOutputResult) if available
          const registryEntry = globalRunRegistry.get(state.runId);
          if (registryEntry?.outputProcessors?.length) {
            try {
              const { ProcessorRunner } = await import('../../../processors/runner');
              const runner = new ProcessorRunner({
                inputProcessors: registryEntry.inputProcessors ?? [],
                outputProcessors: registryEntry.outputProcessors,
                errorProcessors: registryEntry.errorProcessors ?? [],
                logger: logger as any,
                agentName: initData.agentName ?? initData.agentId,
                processorStates: registryEntry.processorStates,
              });
              const outputMessageList = new MessageList();
              outputMessageList.deserialize(state.messageListState);
              // Forward the step's tracingContext so processor_run spans parent
              // to the AGENT_RUN ancestor via ProcessorRunner's findParent walk.
              await runner.runOutputProcessors(
                outputMessageList,
                createObservabilityContext(tracingContext),
                requestContext ?? new RequestContext(),
                0,
              );
            } catch (error) {
              logger?.warn?.(`[DurableAgent] Error running output processors: ${error}`);
            }
          }

          // Memory persistence (executeOnFinish equivalent)
          const durableState = initData.state;
          if (
            registryEntry?.saveQueueManager &&
            registryEntry.memory &&
            durableState?.threadId &&
            durableState?.resourceId &&
            !durableState.observationalMemory
          ) {
            try {
              const memoryMessageList = new MessageList();
              memoryMessageList.deserialize(state.messageListState);

              if (!durableState.threadExists) {
                await registryEntry.memory.createThread?.({
                  threadId: durableState.threadId,
                  resourceId: durableState.resourceId,
                  memoryConfig: durableState.memoryConfig,
                });
              }

              await registryEntry.saveQueueManager.flushMessages(
                memoryMessageList,
                durableState.threadId,
                durableState.memoryConfig,
              );
            } catch (error) {
              logger?.warn?.(`[DurableAgent] Error persisting messages: ${error}`);
            }
          }

          const finalOutput = {
            messageListState: state.messageListState,
            messageId: state.messageId,
            stepResult: state.lastStepResult || {
              reason: 'stop',
              warnings: [],
              isContinued: false,
            },
            output: {
              text: finalText,
              usage: state.accumulatedUsage,
              steps: state.accumulatedSteps,
            },
            state: state.state,
          };

          if (pubsub) {
            await emitFinishEvent(pubsub, state.runId, {
              output: finalOutput.output,
              stepResult: finalOutput.stepResult,
            });
          }

          // End MODEL_GENERATION then AGENT_RUN once at completion. After a resume the
          // originals were ended as `suspended`, so end the *resume* spans (registry override).
          try {
            const observability = (mastra as Mastra | undefined)?.observability?.getSelectedInstance({
              requestContext,
            });
            const reg = globalRunRegistry.get(initData.runId);
            const modelSpanData = reg?.resumeModelSpanData ?? initData.modelSpanData;
            const agentSpanData = reg?.resumeAgentSpanData ?? initData.agentSpanData;
            if (observability) {
              if (modelSpanData) {
                const modelSpan = observability.rebuildSpan(
                  modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION>,
                ) as AIModelGenerationSpan | undefined;
                modelSpan?.createTracker()?.endGeneration({
                  output: { text: finalText },
                  attributes: { finishReason: finalOutput.stepResult?.reason },
                  usage: state.accumulatedUsage,
                });
              }
              if (agentSpanData) {
                const agentSpan = observability.rebuildSpan(agentSpanData as ExportedSpan<SpanType.AGENT_RUN>);
                agentSpan?.end({ output: { text: finalText } });
              }
            }
          } catch (error) {
            logger?.warn?.(`[DurableAgent] Error ending observability spans: ${error}`);
          }

          return finalOutput;
        },
        { id: 'map-final-output' },
      )
      // Execute scorers (fire-and-forget, doesn't affect main result)
      .map(
        async params => {
          const { inputData, getInitData, mastra, requestContext, tracingContext } = params;
          const finalOutput = inputData;
          const initData = getInitData() as DurableAgenticWorkflowInput;

          // If no scorers configured, skip
          const scorers = initData.scorers as SerializableScorersConfig | undefined;
          if (!scorers || Object.keys(scorers).length === 0) {
            return finalOutput;
          }

          const logger = mastra?.getLogger?.();

          // Reconstruct input MessageList to extract scorer input
          const inputMessageList = new MessageList();
          inputMessageList.deserialize(initData.messageListState);

          // Build scorer input (messages before generation)
          const scorerInput = {
            inputMessages: inputMessageList.getPersisted.input.db(),
            rememberedMessages: inputMessageList.getPersisted.remembered.db(),
            systemMessages: inputMessageList.getSystemMessages(),
            taggedSystemMessages: inputMessageList.getPersisted.taggedSystemMessages,
          };

          // Reconstruct output MessageList to extract scorer output
          const outputMessageList = new MessageList();
          outputMessageList.deserialize(finalOutput.messageListState);
          const scorerOutput = outputMessageList.getPersisted.response.db();

          // Create request context for scorer resolution
          const resolveContext = requestContext ?? new RequestContext();

          // Execute each scorer (fire-and-forget)
          for (const [scorerKey, scorerEntry] of Object.entries(scorers)) {
            const { scorerName, sampling } = scorerEntry;

            try {
              // Resolve the scorer from Mastra. We serialize scorers by name,
              // and `getScorerById` searches by id-or-name without throwing
              // on the common path, so try it first. Fall back to the
              // registration-key-keyed `getScorer` for older configs.
              let scorer: MastraScorer | undefined;
              try {
                scorer = (mastra as Mastra)?.getScorerById?.(scorerName) as MastraScorer | undefined;
              } catch {
                scorer = undefined;
              }
              if (!scorer) {
                try {
                  scorer = (mastra as Mastra)?.getScorer?.(scorerName) as MastraScorer | undefined;
                } catch {
                  scorer = undefined;
                }
              }

              if (!scorer) {
                logger?.warn?.(`Scorer ${scorerName} not found in Mastra, skipping`, {
                  runId: initData.runId,
                  scorerKey,
                });
                continue;
              }

              // Create the scorer entry expected by runScorer
              const scorerObject: MastraScorerEntry = {
                scorer,
                sampling,
              };

              // Call runScorer (fire-and-forget via hooks)
              runScorer({
                runId: initData.runId,
                scorerId: scorerKey,
                scorerObject,
                input: scorerInput,
                output: scorerOutput,
                requestContext: resolveContext as any,
                entity: {
                  id: initData.agentId,
                  name: initData.agentName ?? initData.agentId,
                },
                structuredOutput: false,
                source: 'LIVE',
                entityType: 'AGENT',
                threadId: initData.state?.threadId,
                resourceId: initData.state?.resourceId,
                ...createObservabilityContext(tracingContext),
              });
            } catch (error) {
              // Log but don't fail - scorer errors shouldn't affect main execution
              logger?.warn?.(`Error executing scorer ${scorerName}`, {
                error,
                runId: initData.runId,
                scorerKey,
              });
            }
          }

          return finalOutput;
        },
        { id: 'execute-scorers' },
      )
      .commit()
  );
}
