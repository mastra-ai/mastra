import { z } from 'zod';
import type { PubSub } from '../../../events/pubsub';
import type { LoopContinuationPredicate } from '../../../loop/loop-builder';
import { AgenticLoopBuilder } from '../../../loop/loop-builder';
import type { LoopIterationState, LoopRuntime } from '../../../loop/loop-runtime';
import { decideContinuation } from '../../../loop/shared/continuation-core';
import { drainSignalsToTranscript } from '../../../loop/shared/steps/signal-drain-core';
import { pruneAgentLoopSnapshot } from '../../../loop/workflows/prune-snapshot';
import type { Mastra } from '../../../mastra';
import { InternalSpans } from '../../../observability';
import type { AIModelGenerationSpan, ExportedSpan, SpanType } from '../../../observability';
import { PUBSUB_SYMBOL } from '../../../workflows/constants';
import { createEventedWorkflow, createWorkflow } from '../../../workflows/create';
import { createStep } from '../../../workflows/workflow';
import { DurableStepIds, DurableAgentDefaults } from '../constants';
import { globalRunRegistry } from '../run-registry';
import { emitChunkEvent, emitFinishEvent, emitIterationCompleteEvent } from '../stream-adapter';
import type {
  DurableToolCallInput,
  DurableAgenticWorkflowInput,
  DurableAgenticExecutionOutput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
} from '../types';
import { createRunMessageList } from '../utils/run-message-list';
import { runDurableFinishSideEffects } from './finalize-run';
import {
  modelConfigSchema,
  modelListEntrySchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
  resolveDurableToolCallConcurrency,
  executeDurableAgentScorers,
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
  /**
   * Which workflow execution engine runs the loop. `'evented'` builds both
   * the outer loop and the inner single-iteration workflow on the evented
   * execution engine (pubsub + WorkflowEventProcessor); `'default'` (the
   * default) uses the in-process default engine.
   */
  engine?: 'default' | 'evented';
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

/**
 * Schema for the iteration state that flows through the dowhile loop.
 * Extends base schema with model list for fallback support.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
  // Model list for fallback support
  modelList: z.array(z.any()).optional(),
});

/**
 * Compile-time contract check: the durable between-iterations state must stay
 * assignable to the engine-agnostic {@link LoopIterationState} shape that
 * shared continuation logic operates on (both loops converge on it).
 */
type SatisfiesLoopIterationState<T extends LoopIterationState> = T;

type IterationState = SatisfiesLoopIterationState<z.infer<typeof iterationStateSchema>>;

/**
 * Durable resolution of the shared {@link LoopRuntime} contract. Live handles
 * (abort signal, `stopWhen`/`onIterationComplete` closures, the pre-bound
 * signal drain) come from the in-process run registry — closures can't cross
 * the wire — and the transport comes from the engine's predicate params.
 */
interface DurableLoopRuntime extends LoopRuntime {
  /** Always resolved on the durable loop: run options ?? builder default. */
  maxSteps: number;
  /** Present when the run streams through a pubsub transport. */
  pubsub?: PubSub;
}

/**
 * Builds the durable agent loop on the shared `AgenticLoopBuilder` topology.
 *
 * The durable loop implements the same agentic loop pattern as the main loop
 * (LLM execution → tool-call foreach → mapping → background check → signal
 * drain → isTaskComplete → goal, wrapped in a dowhile) but flows all state
 * through workflow input/output so it is durable across process restarts and
 * execution engine replays.
 *
 * Migration status (PHASE3 Step 1): every method is still a whole-method
 * override delegating to the durable step files. As the shared cores land,
 * these overrides shrink until only the runtime hooks remain (state
 * resolution via registry + serialized `messageListState`, pubsub chunk
 * transport, the evented `workflowFactory`, and snapshot policies).
 */
export class DurableAgenticLoopBuilder extends AgenticLoopBuilder {
  readonly #options?: DurableAgenticWorkflowOptions;
  readonly #maxSteps: number;

  constructor(options?: DurableAgenticWorkflowOptions) {
    // No main-loop params: the durable loop resolves its runtime from the run
    // registry and serialized iteration state. Any base method that reads
    // `this.params` on this path throws (see AgenticLoopBuilder).
    super();
    this.#options = options;
    this.#maxSteps = options?.maxSteps ?? DurableAgentDefaults.MAX_STEPS;
  }

  /**
   * Engine selection: EventedAgent opts into the evented execution engine;
   * DurableAgent stays on the default in-process engine.
   */
  protected override workflowFactory(): typeof createWorkflow {
    return this.#options?.engine === 'evented' ? createEventedWorkflow : createWorkflow;
  }

  // ── Runtime hooks ──────────────────────────────────────────────────────

  /**
   * Resolve the runtime from serialized iteration state + the run registry
   * (see {@link DurableLoopRuntime}). Cross-process engines (e.g. Inngest
   * after a worker restart) won't have a registry entry; every
   * registry-derived field is then undefined and the loop falls back to
   * maxSteps-only continuation.
   *
   * Callable from both the continuation predicate (inputData = iteration
   * state) and steps inside the iteration workflow (inputData = an
   * intermediate execution shape without run identity); the latter falls
   * back to init data, which inside the iteration workflow is the iteration
   * state itself.
   */
  protected override resolveRuntime(predicateParams: any): DurableLoopRuntime {
    const state = (predicateParams.inputData ?? {}) as Partial<IterationState>;
    const initData = predicateParams.getInitData() as DurableAgenticWorkflowInput;
    const mastra = predicateParams.mastra as Mastra | undefined;
    const runId = state.runId ?? initData.runId;
    const registryEntry = globalRunRegistry.get(runId);
    return {
      runId,
      agentId: state.agentId ?? initData.agentId,
      agentName: state.agentName ?? initData.agentName,
      threadId: initData?.state?.threadId,
      resourceId: initData?.state?.resourceId,
      maxSteps: state.options?.maxSteps ?? initData.options?.maxSteps ?? this.#maxSteps,
      mastra,
      logger: mastra?.getLogger?.(),
      abortSignal: registryEntry?.abortSignal,
      stopWhen: registryEntry?.stopWhen,
      onIterationComplete: registryEntry?.onIterationComplete,
      // runId is pre-bound at registry-entry creation; scope defaults to
      // 'pending' in the underlying stream runtime (ledger L13).
      drainPendingSignals: registryEntry?.drainPendingSignals,
      pubsub: predicateParams[PUBSUB_SYMBOL] as PubSub | undefined,
    };
  }

  /**
   * Chunk transport: publish through pubsub instead of enqueueing onto a live
   * stream controller. No-op when the run has no pubsub transport — callers
   * that must not consume input without a transport (signal drain) guard on
   * `pubsub` before draining.
   */
  protected override emitChunk(runtime: DurableLoopRuntime, chunk: unknown): void | Promise<void> {
    if (!runtime.pubsub) return;
    return emitChunkEvent(runtime.pubsub, runtime.runId, chunk as any);
  }

  // ── Step factories ─────────────────────────────────────────────────────
  // Tools and model are resolved from Mastra at runtime; the workflow is
  // created once at startup and reused for all runs.

  protected override llmExecutionStep() {
    return createDurableLLMExecutionStep();
  }

  /** Each tool call runs as its own step with suspend support. */
  protected override toolCallStep() {
    return createDurableToolCallStep();
  }

  protected override llmMappingStep() {
    return createDurableLLMMappingStep();
  }

  protected override backgroundTaskCheckStep() {
    return createDurableBackgroundTaskCheckStep();
  }

  /**
   * Mirrors the non-durable `signalDrainStep` which drains signals queued
   * during tool execution. Behavior lives in `drainSignalsToTranscript`
   * (shared with the main loop, ledger L11); this override owns the
   * serialization glue: the `MessageList` is materialized lazily from
   * serialized state only once signals actually arrive (drain-first
   * ordering), and re-serialized into the projected output. Signals are
   * appended to the transcript even without a pubsub transport (`emitChunk`
   * no-ops), matching prior behavior.
   */
  protected override signalDrainStep() {
    return createStep({
      id: `${DurableStepIds.AGENTIC_EXECUTION}-signal-drain`,
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async stepParams => {
        const execOutput = stepParams.inputData as Record<string, any>;
        const rt = this.resolveRuntime(stepParams);
        try {
          let drainList: ReturnType<typeof createRunMessageList> | undefined;
          const list = () =>
            (drainList ??= createRunMessageList({ mastra: rt.mastra }).deserialize(execOutput.messageListState));
          const outcome = await drainSignalsToTranscript({
            drainPendingSignals: rt.drainPendingSignals,
            rotateResponseMessageId: sealMessageId => list().rotateResponseMessageId(sealMessageId),
            addSignal: signal => list().addSignal(signal),
            emitChunk: chunk => this.emitChunk(rt, chunk),
            sealMessageId: execOutput.messageId,
            logger: rt.logger,
          });
          if (!outcome.drained || !drainList) return execOutput;
          return {
            ...execOutput,
            messageListState: drainList.serialize(),
            messageId: outcome.nextMessageId,
            stepResult: {
              ...execOutput.stepResult,
              messageId: outcome.nextMessageId,
              // Aligned with the main loop's signal-drain step (ledger L3).
              reason: 'other',
              isContinued: true,
            },
          };
        } catch {
          // Best-effort: transcript mutations are local to this step's
          // drainList, so returning execOutput drops them cleanly.
          return execOutput;
        }
      },
    });
  }

  /**
   * The isTaskComplete evaluation step (mirrors the non-durable
   * createIsTaskCompleteStep). Lives as a real step (not predicate logic)
   * so it shows up in workflow traces and produces a proper state transition.
   */
  protected override isTaskCompleteStep() {
    return createDurableIsTaskCompleteStep(this.#maxSteps);
  }

  /**
   * The goal evaluation step — mirrors the non-durable `createGoalStep`.
   * Runs after isTaskComplete so the goal judge sees whether isTaskComplete
   * already stopped the loop.
   */
  protected override goalStep() {
    return createDurableGoalStep();
  }

  // ── Composition ────────────────────────────────────────────────────────

  /**
   * The single iteration workflow (LLM -> Tool Calls -> Mapping).
   * Note: tool-call foreach concurrency is resolved per run at execution time
   * (see resolveDurableToolCallConcurrency) — approval/suspend flows force
   * sequential execution; otherwise the run's `toolCallConcurrency` applies.
   */
  override buildIterationWorkflow() {
    const llmExecutionStep = this.llmExecutionStep();
    const toolCallStep = this.toolCallStep();
    const llmMappingStep = this.llmMappingStep();
    const backgroundTaskCheckStep = this.backgroundTaskCheckStep();
    const signalDrainStep = this.signalDrainStep();
    const isTaskCompleteStep = this.isTaskCompleteStep();
    const goalStep = this.goalStep();

    return (
      this.workflowFactory()({
        id: DurableStepIds.AGENTIC_EXECUTION,
        inputSchema: iterationStateSchema,
        outputSchema: iterationStateSchema,
        options: {
          shouldPersistSnapshot: params => {
            // We need a persisted snapshot record to support both:
            //  - `resumeStream()` after a suspend (records with status
            //    `pending` / `paused` / `suspended`)
            //  - boot-time recovery of orphaned RUNNING runs after a process
            //    restart, via `DurableAgent.recoverActiveRuns()` — this requires
            //    the row to actually be stamped `running` while the loop is
            //    in-flight (issue #19056).
            //
            // The engine's persist path guards against overwriting a `suspended`
            // / `paused` snapshot with a later `running` update from the same
            // run (see `persistStepUpdate` in workflows/handlers/entry.ts), so
            // it is safe to return true for `running` here.
            return (
              params.workflowStatus === 'pending' ||
              params.workflowStatus === 'paused' ||
              params.workflowStatus === 'suspended' ||
              params.workflowStatus === 'running'
            );
          },
          // Agent-loop snapshots are pure resume artifacts — strip everything a
          // resume never reads before persisting.
          pruneSnapshot: pruneAgentLoopSnapshot,
          validateInputs: false,
          emitStepEvents: false,
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
              requestContextEntries: state.requestContextEntries,
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
        // Step 3: Execute each tool call individually (with suspend support).
        // Concurrency is resolved per run from the serialized iteration state:
        // approval/suspend-capable tool sets run sequentially, everything else
        // honors the run's `toolCallConcurrency` (default 10). The workflow graph
        // is shared across runs, so this must be a resolver — never a mutated
        // shared options object.
        .foreach(toolCallStep, {
          concurrency: ({ inputData, getInitData }) => {
            const state = getInitData() as IterationState | undefined;
            return resolveDurableToolCallConcurrency({
              options: state?.options,
              toolsMetadata: state?.toolsMetadata,
              toolCalls: inputData as DurableToolCallInput[],
            });
          },
        })
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
        // Step 6.5: Drain signals that were queued while tool execution was running
        // within this iteration. Mirrors the non-durable `signalDrainStep` which
        // sits between backgroundTaskCheckStep and isTaskCompleteStep.
        .then(signalDrainStep)
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
        .commit()
    );
  }

  /**
   * The dowhile predicate: abort check, feedback two-phase stop, stopWhen
   * evaluation, delegation bail, inter-iteration signal drain, the
   * onIterationComplete hook, response-message boundary rotation, and the
   * iteration-complete observability event.
   */
  protected override buildContinuationPredicate(): LoopContinuationPredicate {
    return async (params: any) => {
      const state = params.inputData as IterationState;
      const initData = params.getInitData() as DurableAgenticWorkflowInput;
      const rt = this.resolveRuntime(params);

      // ── Abort check ────────────────────────────────────────────────
      // If the abort signal has fired, stop the loop immediately.
      // The llm-execution step may have already emitted the ABORT event
      // and returned a clean output, but the signal may also have fired
      // between steps (e.g. inside a tool). Override the stepResult
      // reason so the FINISH event carries 'abort' and the client sees
      // the correct finishReason.
      if (rt.abortSignal?.aborted) {
        if (state.lastStepResult) {
          state.lastStepResult.reason = 'abort';
          state.lastStepResult.isContinued = false;
        }
        return false;
      }

      // ── Inter-iteration signal drain ──────────────────────────────
      // Mirror the non-durable agentic-loop predicate: drain pending
      // signals that were queued while the previous iteration was
      // running. If signals are present, mark a response boundary,
      // rotate the messageId, add them to the transcript, emit them
      // to the stream, and force continuation so the LLM sees them.
      // Runs before the continuation decision (matching the main loop) so
      // stopWhen still applies to a signal-forced turn.
      // Behavior shared with the main-loop predicate via
      // `drainSignalsToTranscript`; this site owns the pubsub guard (don't
      // consume signals without a transport to emit them on) and the
      // serialize/deserialize glue. Drain is best-effort: failures inside the
      // core resolve to `drained: false` and the next iteration runs with the
      // un-drained state.
      let drainForcedContinue = false;
      if (rt.pubsub && rt.drainPendingSignals) {
        try {
          let drainList: ReturnType<typeof createRunMessageList> | undefined;
          const list = () =>
            (drainList ??= createRunMessageList({ mastra: rt.mastra }).deserialize(state.messageListState));
          const drainOutcome = await drainSignalsToTranscript({
            drainPendingSignals: rt.drainPendingSignals,
            rotateResponseMessageId: () => list().rotateResponseMessageId(),
            addSignal: signal => list().addSignal(signal),
            emitChunk: chunk => this.emitChunk(rt, chunk),
            logger: rt.logger,
          });
          if (drainOutcome.drained && drainList) {
            state.messageId = drainOutcome.nextMessageId;
            state.messageListState = drainList.serialize();

            // Force continuation — the LLM must see the injected signals
            if (state.lastStepResult) {
              state.lastStepResult.isContinued = true;
            }
            drainForcedContinue = true;
          }
        } catch {
          // serialize() is best-effort too; state keeps the pre-drain
          // messageListState if it throws.
        }
      }

      const runMaxSteps = rt.maxSteps;

      // Lazy message-list rehydration for the onIterationComplete hook: the
      // callback's messages snapshot and any injected feedback share one
      // instance, re-serialized into state when feedback lands. Only
      // deserialized when the hook actually runs.
      let callbackListInstance: ReturnType<typeof createRunMessageList> | undefined;
      const callbackList = () => {
        if (!callbackListInstance) {
          callbackListInstance = createRunMessageList({ mastra: rt.mastra });
          try {
            callbackListInstance.deserialize(state.messageListState);
          } catch {
            // If deserialization fails, callback sees empty messages
          }
        }
        return callbackListInstance;
      };

      // Shared continuation decision: two-phase feedback stop, stopWhen (read
      // from the in-process registry — the predicate is a closure and can't
      // survive the wire; cross-process engines fall back to maxSteps only),
      // delegation bail, and the onIterationComplete ladder (see
      // `decideContinuation` for the semantics and adjudications).
      const decision = await decideContinuation({
        pendingFeedbackStop: state.pendingFeedbackStop ?? false,
        llmWantsToContinue: state.lastStepResult?.isContinued === true || drainForcedContinue,
        underMaxSteps: state.iterationCount < runMaxSteps,
        steps: state.accumulatedSteps,
        stopWhen: rt.stopWhen,
        consumeDelegationBail: () => {
          if (state.delegationBailed) {
            // Reset the flag so it doesn't carry forward
            state.delegationBailed = false;
            return true;
          }
          return false;
        },
        backgroundTaskPending: state.backgroundTaskPending,
        onIterationComplete: rt.onIterationComplete,
        buildIterationContext: isFinal => {
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          return {
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
            threadId: rt.threadId,
            resourceId: rt.resourceId,
            agentId: rt.agentId,
            agentName: rt.agentName ?? rt.agentId,
            messages: callbackList().get.all.db(),
          };
        },
        injectFeedback: feedback => {
          // Inject feedback as a synthetic assistant message so the LLM
          // sees it on the next turn. Mirror the regular agent: mark it
          // with completionResult.suppressFeedback so isTaskComplete
          // scorers skip it.
          const feedbackId = rt.mastra?.generateId?.() ?? globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}`;
          callbackList().add(
            {
              id: feedbackId,
              createdAt: new Date(),
              type: 'text',
              role: 'assistant',
              content: {
                parts: [{ type: 'text', text: feedback }],
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
          state.messageListState = callbackList().serialize();
        },
        logger: rt.logger,
      });

      state.pendingFeedbackStop = decision.nextPendingFeedbackStop;
      if (decision.forceContinue && state.lastStepResult) {
        state.lastStepResult.isContinued = true;
      }
      const isFinal = decision.isFinal;

      // Each iteration's assistant response is a distinct message, mirroring
      // the non-durable agentic loop. The mutated state.messageId flows into
      // the next singleIterationWorkflow input via map-to-llm-input.
      if (!isFinal) {
        const boundaryList = createRunMessageList({ mastra: rt.mastra }).deserialize(state.messageListState);
        state.messageId = boundaryList.rotateResponseMessageId();
        state.messageListState = boundaryList.serialize();
      }

      // Emit an iteration-complete event for observability. This fires after
      // every iteration (including the last one) so client-side callbacks
      // (via stream-adapter) can track progress. The in-process callback
      // above has already been evaluated and its result applied to the
      // continuation decision.
      if (rt.pubsub) {
        const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
        await emitIterationCompleteEvent(rt.pubsub, state.runId, {
          iteration: state.iterationCount,
          maxIterations: runMaxSteps,
          text: lastStep?.text,
          toolCalls: lastStep?.toolCalls,
          toolResults: lastStep?.toolResults,
          isFinal,
          finishReason: lastStep?.finishReason,
          runId: state.runId,
          threadId: rt.threadId,
          resourceId: rt.resourceId,
          agentId: initData.agentId,
          agentName: initData.agentName,
        });
      }

      return !isFinal;
    };
  }

  /**
   * The outer loop workflow: init iteration state → dowhile(single iteration,
   * continuation predicate) → finalize (output mapping, memory persistence,
   * finish event, span closure) → fire-and-forget scorers.
   */
  override build() {
    return (
      this.workflowFactory()({
        id: DurableStepIds.AGENTIC_LOOP,
        inputSchema: durableAgenticInputSchema,
        outputSchema: durableAgenticOutputSchema,
        options: {
          shouldPersistSnapshot: params => {
            // See the singleIterationWorkflow comment above — same policy for
            // the outer loop. The persist path guards against overwriting a
            // suspended snapshot with running.
            return (
              params.workflowStatus === 'pending' ||
              params.workflowStatus === 'paused' ||
              params.workflowStatus === 'suspended' ||
              params.workflowStatus === 'running'
            );
          },
          // Agent-loop snapshots are pure resume artifacts — strip everything a
          // resume never reads before persisting.
          pruneSnapshot: pruneAgentLoopSnapshot,
          validateInputs: false,
          emitStepEvents: false,
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
        .dowhile(this.buildIterationWorkflow(), this.buildContinuationPredicate())
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
            let finalText = lastStep?.text;

            const finishResult = await runDurableFinishSideEffects({
              runId: state.runId,
              initData,
              messageListState: state.messageListState,
              mastra: mastra as Mastra | undefined,
              requestContext,
              tracingContext,
              logger,
              outputResult: {
                text: finalText ?? '',
                usage: state.accumulatedUsage,
                finishReason: state.lastStepResult?.reason ?? 'unknown',
                steps: state.accumulatedSteps,
              },
            });
            if (lastStep && finishResult.outputText && finishResult.outputText !== (finalText ?? '')) {
              lastStep.text = finishResult.outputText;
              finalText = finishResult.outputText;
            }

            const finalOutput = {
              messageListState: finishResult.messageListState,
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
          async ({ inputData, getInitData, mastra, requestContext, tracingContext }) => {
            executeDurableAgentScorers({
              initData: getInitData() as DurableAgenticWorkflowInput,
              finalOutput: inputData,
              mastra: mastra as Mastra | undefined,
              requestContext,
              tracingContext,
            });

            return inputData;
          },
          { id: 'execute-scorers' },
        )
        .commit()
    );
  }
}
