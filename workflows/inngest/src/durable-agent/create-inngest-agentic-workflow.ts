import { buildDeferredStepFinishChunk, durableStopConditionSteps } from '@internal/core/durable';
import {
  createDurableBackgroundTaskCheckStep,
  createDurableGoalStep,
  createDurableIsTaskCompleteStep,
  createDurableLLMExecutionStep,
  createDurableLLMMappingStep,
  createDurableToolCallStep,
  DURABLE_STOP_WHEN_ERROR_ID,
  DurableAgentDefaults,
  DurableStepIds,
  emitAbortEvent,
  emitChunkEvent,
  emitErrorEvent,
  emitFinishEvent,
  runDurableFinishSideEffects,
  modelConfigSchema,
  modelListEntrySchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
  diffResponseMessages,
  AGENT_STREAM_TOPIC,
  resolveDurableToolCallConcurrency,
  executeDurableAgentScorers,
  getRunRegistryEntry,
  loadRunStoredMessages,
  takeRunScorerInstances,
  pruneAgentLoopSnapshot,
  readRunDeadline,
} from '@mastra/core/agent/durable';
import type {
  DurableAgenticExecutionOutput,
  DurableAgenticWorkflowInput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
  DurableToolCallInput,
  ResponseMessagesCursor,
} from '@mastra/core/agent/durable';
import { MessageList } from '@mastra/core/agent/message-list';
import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '@mastra/core/error';
import type { PubSub } from '@mastra/core/events';
import { isMastraTimeoutError, MastraTimeoutError } from '@mastra/core/loop';
import type { Mastra } from '@mastra/core/mastra';
import { InternalSpans } from '@mastra/core/observability';
import type { AIModelGenerationSpan, ExportedSpan, SpanType } from '@mastra/core/observability';
import type { RunFence } from '@mastra/core/storage';
import { ChunkFrom } from '@mastra/core/stream';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import type { BaseContext, Inngest } from 'inngest';
import { z } from 'zod';

import { RESUME_CLAIM_DISPATCH_LEASE_MS } from '../durable-event-payload';
import { init } from '../index';
import { agentLoopTermination, executionFailureTermination, generationUsage } from '../observability-compat';
import { InngestPubSub } from '../pubsub';
import type { InngestFlowControlConfig } from '../types';
import type { InngestWorkflow } from '../workflow';

// Suspended snapshots back human-in-the-loop resume. Terminal statuses are also
// persisted so a finished run's snapshot replaces its stale suspended one and
// resume() rejects it instead of re-running the suspended tool.
const PERSISTED_SNAPSHOT_STATUSES = new Set<string>([
  'suspended',
  'success',
  'failed',
  'canceled',
  'bailed',
  'tripwire',
]);

/**
 * Input schema for the durable agentic workflow.
 * Extends base with observability fields for Inngest.
 */
const durableAgenticInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  initialUntaggedSystemMessages: z.array(z.any()).optional(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  modelList: z.array(modelListEntrySchema).optional(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // JSON-safe snapshot of the caller's request context. Inngest runs durable
  // steps on a separate worker process, so this snapshot is the only way the
  // rebuild path can recover request-scoped configuration.
  requestContextEntries: z.record(z.string(), z.any()).optional(),
  inputTripwire: baseIterationStateSchema.shape.inputTripwire,
  // Observability fields (Inngest-specific)
  agentSpanData: z.any().optional(),
  modelSpanData: z.any().optional(),
  stepIndex: z.number().optional(),
});

// Output schema imported from shared (durableAgenticOutputSchema)

/**
 * Options for creating an Inngest durable agentic workflow
 */
export interface InngestDurableAgenticWorkflowOptions {
  /** Inngest client instance */
  inngest: Inngest;
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
  /** Inngest function-level retries for the agentic loop and iteration functions (defaults to 0) */
  retries?: InngestFlowControlConfig['retries'];
}

/**
 * Iteration state schema - extends base with observability fields.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
  // This loop threads step records through the iteration payload
  accumulatedSteps: z.array(z.any()),
  // Fallback model list; the shared base state update does not carry it
  modelList: z.array(modelListEntrySchema).optional(),
  // Observability - exported span data for agent run
  agentSpanData: z.any().optional(),
  // Observability - exported span data for model generation (ONE span for entire run)
  modelSpanData: z.any().optional(),
  // Step index for continuation across iterations (maintains step: 0, 1, 2, ...)
  stepIndex: z.number(),
});

type IterationState = z.infer<typeof iterationStateSchema> & {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
};

/**
 * Create a durable agentic workflow using Inngest.
 *
 * This workflow implements the agentic loop pattern in a durable way using
 * Inngest's execution engine:
 *
 * 1. LLM Execution Step - Calls the LLM and gets response/tool calls
 * 2. Tool Call Steps (foreach) - Executes each tool call individually with suspend support
 * 3. LLM Mapping Step - Merges tool results back into state
 * 4. Loop - Continues if more tool calls are needed (dowhile)
 *
 * All state flows through workflow input/output, making it durable across
 * process restarts and execution engine replays.
 *
 * @param options - Configuration options
 * @returns An InngestWorkflow instance that implements the agentic loop
 */
/** Prefix for Inngest engine workflow IDs to avoid collision with other engines */
const INNGEST_ENGINE_PREFIX = 'inngest';

/** Inngest-prefixed workflow IDs */
export const InngestDurableStepIds = {
  AGENTIC_EXECUTION: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_EXECUTION}`,
  AGENTIC_LOOP: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_LOOP}`,
} as const;

/** Run ownership key of the claim an InngestAgent resume holds on the loop run. */
export const resumeClaimKey = (runId: string) => `${InngestDurableStepIds.AGENTIC_LOOP}:resume-claim:${runId}`;

/**
 * The store a resume claim lives in. A claim needs an atomic status change and a lease, so a
 * claim whose resume died can be taken over; without both, resumes are not claimed at all.
 */
export async function resumeClaimStore(mastra: Mastra | undefined) {
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!store?.supportsConcurrentUpdates?.()) return undefined;
  const fencing = await Promise.resolve()
    .then(() => store.supportsRunFencing())
    .catch(() => false);
  return fencing ? store : undefined;
}

export const setLoopStatus = (
  store: NonNullable<Awaited<ReturnType<typeof resumeClaimStore>>>,
  runId: string,
  status: WorkflowRunState['status'],
  expectedStatus: WorkflowRunState['status'],
) =>
  store.updateWorkflowState({
    workflowName: InngestDurableStepIds.AGENTIC_LOOP,
    runId,
    opts: { status, expectedStatus },
  });

/**
 * Ends a resumed segment Inngest failed or cancelled, which never reaches the finalize step that
 * would: marks the run failed or canceled, ends its stream and releases its claim. The run is not
 * parked again, since a nested segment Inngest did not cancel can still be running its tools.
 */
function createResumeClaimReleaseFunction(inngest: Inngest, workflow: InngestWorkflow) {
  const loopEvent = `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`;
  return inngest.createFunction(
    {
      id: `${loopEvent}.resume-claim-release`,
      triggers: [
        { event: 'inngest/function.failed', if: `event.data.event.name == '${loopEvent}'` },
        { event: 'inngest/function.cancelled', if: `event.data.event.name == '${loopEvent}'` },
      ],
    },
    async ({ event }) => {
      const original = (event.data as { event?: { data?: Record<string, any> } }).event?.data;
      const claim: RunFence | undefined = original?.resume?.claim;
      const mastra = workflow.mastra;
      const store = await resumeClaimStore(mastra);
      if (!original?.runId || !claim || !store) return;
      // Fails once finalize released the claim or a later resume took it over. A renewed claim also
      // keeps a takeover out until this release is done.
      const held = await store.renewRunOwnership({ ...claim, leaseMs: RESUME_CLAIM_DISPATCH_LEASE_MS });
      if (!held.renewed) return;
      const cancelled = event.name === 'inngest/function.cancelled';
      await setLoopStatus(store, original.runId, cancelled ? 'canceled' : 'failed', 'running');
      const defaultPubsub = new InngestPubSub(inngest, workflow.id, mastra?.getLogger?.());
      const pubsub = workflow.__getPubsubFactory()?.(defaultPubsub) ?? defaultPubsub;
      try {
        if (cancelled) {
          await emitAbortEvent(pubsub, original.runId, { steps: [], text: '' });
        } else {
          const message = (event.data as { error?: { message?: string } }).error?.message;
          await emitErrorEvent(pubsub, original.runId, new Error(message ?? 'The resumed agent run failed.'));
        }
      } catch (error) {
        mastra?.getLogger?.()?.warn?.(`[InngestAgent] run ${original.runId} failed to publish its end`, error);
      }
      await store.releaseRunOwnership(claim);
    },
  );
}

export function createInngestDurableAgenticWorkflow(options: InngestDurableAgenticWorkflowOptions) {
  const workflow = createAgenticLoopWorkflow(options);
  // The chained `.commit()` builder loses the InngestWorkflow subtype, so cast back.
  const inngestWorkflow = workflow as unknown as InngestWorkflow;
  inngestWorkflow.__addHostFunctions([createResumeClaimReleaseFunction(options.inngest, inngestWorkflow)]);
  return workflow;
}

function createAgenticLoopWorkflow(options: InngestDurableAgenticWorkflowOptions) {
  const { inngest, maxSteps = DurableAgentDefaults.MAX_STEPS, retries } = options;
  const { createWorkflow } = init(inngest);

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the tool call step - each tool call runs as its own step with suspend support
  const toolCallStep = createDurableToolCallStep();

  // Create the LLM mapping step - reuse from core
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the background task check step
  const backgroundTaskCheckStep = createDurableBackgroundTaskCheckStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  const singleIterationWorkflow = createWorkflow({
    id: InngestDurableStepIds.AGENTIC_EXECUTION,
    retries,
    inputSchema: iterationStateSchema,
    outputSchema: iterationStateSchema,
    options: {
      tracingPolicy: {
        // Mark all workflow spans as internal so they're hidden in traces
        // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: ({ workflowStatus }) => PERSISTED_SNAPSHOT_STATUSES.has(workflowStatus),
      pruneSnapshot: pruneAgentLoopSnapshot,
      evaluatePersistencePredicateBeforeDurableOperation: true,
      validateInputs: false,
      emitStepEvents: false,
    },
    steps: [],
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
          initialUntaggedSystemMessages: state.initialUntaggedSystemMessages,
          toolsMetadata: state.toolsMetadata,
          modelConfig: state.modelConfig,
          modelList: state.modelList,
          options: state.options,
          state: state.state,
          messageId: state.messageId,
          // Pass the request context snapshot so dynamic model/tool resolvers
          // see the caller's context on every iteration, not just the first.
          requestContextEntries: state.requestContextEntries,
          inputTripwire: state.inputTripwire,
          // Pass agent span data so model spans can use it as parent
          agentSpanData: state.agentSpanData,
          // Pass model span data (ONE span for entire agent run)
          modelSpanData: state.modelSpanData,
          // First-chunk clock carried from earlier iterations (first write wins)
          completionStartTime: state.completionStartTime,
          timeToFirstTokenMs: state.timeToFirstTokenMs,
          // Pass step index for continuation (step: 0, 1, 2, ...)
          stepIndex: state.stepIndex,
          accumulatedSteps: state.accumulatedSteps,
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
          completionStartTime: llmOutput.completionStartTime,
          timeToFirstTokenMs: llmOutput.timeToFirstTokenMs,
          stepUsage: llmOutput.stepResult?.totalUsage,
        })) as DurableToolCallInput[];
      },
      { id: 'extract-tool-calls' },
    )
    // Step 3: Execute each tool call individually (with suspend support).
    // Tool result/error PubSub emission is handled by createDurableToolCallStep.
    // Concurrency is resolved per run at execution time from the serialized
    // iteration state (never a shared mutable object — the workflow instance is
    // reused across runs and Inngest replays memoized steps): approval/suspend
    // tool sets run sequentially, otherwise the run's `toolCallConcurrency`
    // applies (default 10). Mirrors @mastra/core's behavior after #9704.
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
    // Step 4: Collect tool results and bundle with LLM output for mapping step.
    // Span bookkeeping happens elsewhere: each tool call creates its own live
    // TOOL_CALL span (createDurableToolCallStep, via the forwarded stepSpanData),
    // and the shared llmMappingStep ends the MODEL_STEP span and emits
    // tool-result MODEL_CHUNK events.
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
          // A processor retry rotates the response message id; carry it forward as core does.
          messageId: llmOutput?.stepResult?.messageId ?? initData.messageId,
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

        // Extend with Inngest-specific observability fields
        const newIterationState: IterationState = {
          ...baseUpdate,
          modelList: initData.modelList,
          // Preserve agent span data for observability
          agentSpanData: initData.agentSpanData,
          // Preserve model span data (ONE span for entire agent run)
          modelSpanData: initData.modelSpanData,
          // Increment step index for next iteration (step: 0 → 1 → 2 → ...)
          stepIndex: initData.stepIndex + 1,
        };

        return newIterationState;
      },
      { id: 'update-iteration-state' },
    )
    // Step 8: isTaskComplete scorers, then goal evaluation, as in core's durable loop.
    // Both read their closures from the in-process run registry and no-op without them.
    .then(createDurableIsTaskCompleteStep(maxSteps))
    .then(createDurableGoalStep())
    .commit();

  // Create the main agentic loop workflow with dowhile
  return (
    createWorkflow({
      id: InngestDurableStepIds.AGENTIC_LOOP,
      retries,
      inputSchema: durableAgenticInputSchema,
      outputSchema: durableAgenticOutputSchema,
      options: {
        tracingPolicy: {
          // Mark all workflow spans as internal so they're hidden in traces
          // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
          internal: InternalSpans.WORKFLOW,
        },
        shouldPersistSnapshot: ({ workflowStatus }) => PERSISTED_SNAPSHOT_STATUSES.has(workflowStatus),
        pruneSnapshot: pruneAgentLoopSnapshot,
        evaluatePersistencePredicateBeforeDurableOperation: true,
        validateInputs: false,
        emitStepEvents: false,
      },
      steps: [],
    })
      // Initialize iteration state from input
      // The AGENT_RUN span is created BEFORE the workflow starts (in InngestAgent.stream)
      // and passed via input.agentSpanData so the agent_run is the root of the trace
      .map(
        async ({ inputData }) => {
          const input = inputData as DurableAgenticWorkflowInput;
          const initialMessageList = new MessageList().deserialize(input.messageListState);

          // Use the agent span data passed from InngestAgent.stream()
          // This span was created before the workflow started, making it the trace root
          const agentSpanData = input.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined;
          // Use the model span data passed from InngestAgent.stream()
          // This ensures ONE model_generation span contains all steps (like regular agents)
          const modelSpanData = input.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;

          const iterationState: IterationState = {
            ...input,
            initialUntaggedSystemMessages: initialMessageList.getSystemMessages(),
            iterationCount: 0,
            accumulatedSteps: [],
            accumulatedUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            lastStepResult: undefined,
            agentSpanData,
            modelSpanData,
            stepIndex: input.stepIndex ?? 0,
          };
          return iterationState;
        },
        { id: 'init-iteration-state' },
      )
      // Run the agentic loop with dowhile
      .dowhile(singleIterationWorkflow, async params => {
        const { inputData, engine, mastra } = params;
        const state = inputData as IterationState;
        const tracingRegistry = getRunRegistryEntry(state.runId, mastra);
        const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
        const { step, inngestRunId } = engine as { step: BaseContext<Inngest>['step']; inngestRunId?: string };

        const emitStepFinish = async (isContinued: boolean) => {
          if (state.lastStepResult) {
            state.lastStepResult.isContinued = isContinued;
          }
          const deferredChunk = buildDeferredStepFinishChunk(state, isContinued);
          state.deferredStepFinishChunk = undefined;
          if (deferredChunk && pubsub) {
            // Carry the step's response messages so `onStepFinish(event).response.messages` and
            // `output.steps[i].response.messages` match the regular loop (#26780), as core does:
            // only the part that changed since the previous step-finish, which readers rebuild. The
            // diff is built inside the memoized step, so replays reuse it rather than recompute it,
            // and the cursor it returns travels with the iteration state. Each Inngest function run
            // (the first one, and each resume) starts with the whole list.
            const previousCursor = state.responseMessagesCursor;
            const nextCursor: ResponseMessagesCursor | null = await step.run(
              `emit-step-finish-${state.runId}-${state.iterationCount}`,
              async () => {
                let cursor: ResponseMessagesCursor | null = null;
                try {
                  const list = new MessageList({}).deserialize(state.messageListState);
                  const producer = `inngest:${state.runId}:${inngestRunId ?? ''}`;
                  let sent: ResponseMessagesCursor | { producer: string } =
                    previousCursor?.producer === producer ? previousCursor : { producer };
                  // A reader that attaches mid-run on a bus that keeps no history can only place whole lists.
                  if ('fingerprints' in sent && !pubsub.__replaysTopic(AGENT_STREAM_TOPIC(state.runId))) {
                    sent = { ...sent, fingerprints: [] };
                  }
                  const result = diffResponseMessages(sent, list.get.response.aiV5.model());
                  deferredChunk.payload._durableResponseMessagesDiff = result.diff;
                  cursor = result.cursor;
                } catch (error) {
                  mastra
                    ?.getLogger?.()
                    ?.warn?.(`[InngestDurableAgent] Could not rebuild step-finish messages: ${error}`);
                }
                await emitChunkEvent(pubsub, state.runId, deferredChunk);
                return cursor;
              },
            );
            if (nextCursor) state.responseMessagesCursor = nextCursor;
          }
        };

        // A tool the total deadline or abort() stopped ends the run. The flag travels on iteration state
        // because this predicate can run on a worker that never received the abort request.
        if (state.deadlineTimeout || state.runAborted) {
          if (tracingRegistry) tracingRegistry.tracingStopCause = 'model_finished';
          await emitStepFinish(false);
          return false;
        }

        // bail() from a delegation hook is a hard stop. The flag travels on
        // serialized iteration state (set by the tool-call step, aggregated by
        // llm-mapping), so it survives the wire to this cross-process predicate.
        // The stop cause travels on the state, so the final step classifies the run on a worker
        // that never held this registry entry. The registry copy is the final step's fallback.
        const recordStopCause = (cause: NonNullable<IterationState['tracingStopCause']>) => {
          state.tracingStopCause = cause;
          if (tracingRegistry) tracingRegistry.tracingStopCause = cause;
        };

        if (state.delegationBailed) {
          recordStopCause(state.lastStepResult?.isContinued ? 'delegation' : 'model_finished');
          await emitStepFinish(false);
          return false;
        }

        // Check if we should continue
        const shouldContinue = state.lastStepResult?.isContinued === true;
        // Use maxSteps from options (per-request), falling back to workflow-level default
        const effectiveMaxSteps = state.options?.maxSteps ?? maxSteps;
        const underMaxSteps = state.iterationCount < effectiveMaxSteps;

        if (!shouldContinue || !underMaxSteps) {
          recordStopCause(shouldContinue ? 'max_steps' : 'model_finished');
          await emitStepFinish(false);
          return false;
        }

        // stopWhen is a closure parked on the in-process run registry; on a
        // cross-worker resume the entry is absent and we fall back to maxSteps.
        // The lookup happens inside a memoized step so Inngest replays reuse the
        // recorded decision (even on a worker without the registry entry) instead
        // of re-invoking (possibly stateful) user predicates. The `stop-when-`
        // prefix is also the serve transport's failure classifier because Inngest
        // StepError serialization drops the MastraError id/details; keep it in sync
        // with durableAgentWorkflowError in workflow.ts.
        const stopped = await step.run(`stop-when-${state.runId}-${state.iterationCount}`, async () => {
          const stopWhen = getRunRegistryEntry(state.runId, mastra)?.stopWhen;
          if (!stopWhen || state.accumulatedSteps.length === 0) {
            return false;
          }
          // Hand stopWhen the full step content stream.steps reports, not the
          // compacted snapshot records, with AI SDK tool-result parts as toolResults.
          const steps = durableStopConditionSteps(state.accumulatedSteps) as any;
          const conditions = await Promise.all(
            (Array.isArray(stopWhen) ? stopWhen : [stopWhen]).map(async condition => {
              try {
                return await condition({ steps });
              } catch (error) {
                const originalError = getErrorFromUnknown(error);
                throw new MastraError(
                  {
                    id: DURABLE_STOP_WHEN_ERROR_ID,
                    domain: ErrorDomain.AGENT,
                    category: ErrorCategory.USER,
                    text: originalError.message,
                    details: { name: originalError.name, message: originalError.message },
                  },
                  originalError,
                );
              }
            }),
          );
          return conditions.some(Boolean);
        });

        if (stopped) recordStopCause('stop_condition');
        await emitStepFinish(!stopped);
        return !stopped;
      })
      // Map final state to output format, close agent span, and emit finish event
      .map(
        async params => {
          const { inputData, mastra, requestContext, tracingContext } = params;
          const state = inputData as IterationState;
          const tracingRegistry = getRunRegistryEntry(state.runId, mastra);
          const initData = params.getInitData() as DurableAgenticWorkflowInput;

          // Access pubsub via symbol to emit finish event
          const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

          // A run its total deadline aborted ends as the deadline error, not an abort. The abort
          // reaches this worker either through the caller's composed signal (same process) or as a
          // timeout abort request over pubsub (another worker). A worker that saw neither still has the
          // deadline carried on request context: past it, the caller has already reported the timeout.
          // A run the caller aborted first stays an abort: the caller's deadline stopped with it.
          const resolveDeadlineError = () => {
            const abortReason = tracingRegistry?.abortSignal?.aborted ? tracingRegistry.abortSignal.reason : undefined;
            const carriedDeadline = readRunDeadline(requestContext);
            return isMastraTimeoutError(abortReason) && abortReason.timeoutType === 'total'
              ? abortReason
              : state.deadlineTimeout
                ? new MastraTimeoutError(state.deadlineTimeout)
                : !state.runAborted && carriedDeadline && Date.now() >= carriedDeadline.at
                  ? new MastraTimeoutError({ timeoutType: 'total', timeoutMs: carriedDeadline.timeoutMs })
                  : undefined;
          };
          const sideEffectsDeadlineError = resolveDeadlineError();

          // Extract final text from last step
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          let finalText = lastStep?.text;

          // Run finish side effects directly. This mapping already executes inside the
          // engine's durable step boundary (`inngestStep.run`), so
          // wrapping this call in `params.engine.step.run(...)` would create a nested
          // Inngest step, which the Inngest protocol does not support: the nested step's
          // callback never executes and its promise never settles, hanging the run and
          // silently skipping output processors, memory persistence, and title generation.
          const finishResult = await runDurableFinishSideEffects({
            runId: state.runId,
            initData,
            messageListState: state.messageListState,
            mastra,
            requestContext,
            tracingContext,
            logger: mastra?.getLogger?.(),
            messageId: state.messageId,
            outputResult: {
              text: finalText ?? '',
              usage: state.accumulatedUsage,
              finishReason: sideEffectsDeadlineError
                ? 'error'
                : state.runAborted
                  ? 'abort'
                  : (state.lastStepResult?.reason ?? 'unknown'),
              steps: state.accumulatedSteps,
            },
          });
          const textRewritten = !!lastStep && finishResult.outputTextChanged;
          if (lastStep && finishResult.outputTextChanged) {
            lastStep.text = finishResult.outputText;
            finalText = finishResult.outputText;
          }

          const tripwire = finishResult.tripwire;
          if (pubsub && !tripwire) {
            for (const chunk of finishResult.structuredOutputChunks ?? []) {
              await emitChunkEvent(pubsub, state.runId, { ...chunk, runId: state.runId } as any);
            }
          }
          if (pubsub) {
            for (const chunk of finishResult.outputResultChunks ?? []) {
              await emitChunkEvent(pubsub, state.runId, chunk, true);
            }
          }
          if (tripwire && pubsub) {
            await emitChunkEvent(pubsub, state.runId, {
              type: 'tripwire',
              runId: state.runId,
              from: ChunkFrom.AGENT,
              payload: tripwire,
            });
          }

          // generateTitle.emitEvent: hold FINISH until the title is saved, then stream it as a
          // transient chunk so consumers see it before the stream closes (as core does).
          if (pubsub && !tripwire && finishResult.titleForStream) {
            const title = await finishResult.titleForStream;
            if (title && initData.state?.threadId) {
              await emitChunkEvent(pubsub, state.runId, {
                type: 'data-thread-title',
                data: { threadId: initData.state.threadId, title },
                transient: true,
              });
            }
          }

          // The deadline can expire while the side effects or the title generation run; the caller
          // has then already reported the timeout, so the run must end as it here too.
          const deadlineError = sideEffectsDeadlineError ?? resolveDeadlineError();

          const finalOutput = {
            messageListState: finishResult.messageListState,
            messageId: state.messageId,
            stepResult: tripwire
              ? { ...(state.lastStepResult ?? { warnings: [] }), reason: 'tripwire' as const, isContinued: false }
              : deadlineError
                ? { ...(state.lastStepResult ?? { warnings: [] }), reason: 'error' as const, isContinued: false }
                : state.runAborted
                  ? { ...(state.lastStepResult ?? { warnings: [] }), reason: 'abort' as const, isContinued: false }
                  : state.lastStepResult || {
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

          // End MODEL_GENERATION span with final output (children before parent)
          // This span was created BEFORE the workflow started and stayed open for all iterations.
          // Same shape as the core durable agent: `text` and the run's `toolCalls` are the output,
          // usage goes to the attributes through the tracker so consumers find it where every
          // other model span puts it.
          const observability = mastra?.observability?.getSelectedInstance({});
          // Resumed segments carry their own clocks beside their fresh spans.
          const registry = getRunRegistryEntry(state.runId, mastra);
          // A tripwire keeps its own classification; otherwise a deadline-stopped run ends its spans as
          // the timeout failure rather than a normal loop finish.
          const deadlineTermination =
            deadlineError && !tripwire ? executionFailureTermination(deadlineError) : undefined;
          const completionClock = registry?.resumeModelSpanData
            ? registry.resumeCompletionStartTime
            : state.completionStartTime;
          const timeToFirstTokenMs = registry?.resumeModelSpanData
            ? registry.resumeTimeToFirstTokenMs
            : state.timeToFirstTokenMs;
          const clocks = {
            ...(completionClock ? { completionStartTime: new Date(completionClock) } : {}),
            ...(timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs } : {}),
          };
          // The state carries the facts across workers; the registry is the fallback for
          // runs whose snapshots predate those fields.
          const finishReason = finalOutput.stepResult?.reason;
          const stopCause = state.tracingStopCause ?? registry?.tracingStopCause;
          const recordedTermination = state.tracingTermination ?? registry?.tracingTermination;
          if (!stopCause && (finishReason === 'stop' || finishReason === 'tool-calls')) {
            mastra
              ?.getLogger?.()
              ?.warn?.(
                `[InngestDurableAgent] Run ${state.runId} has no recorded stop cause; its span outcome is unknown`,
              );
          }
          const termination = deadlineTermination
            ? deadlineTermination
            : ['tripwire', 'error'].includes(finishReason ?? '') && recordedTermination
              ? recordedTermination
              : agentLoopTermination({
                  stopCause,
                  delegationFailure: state.tracingDelegationFailure ?? registry?.tracingDelegationFailure,
                  finishReason,
                  tripwire: tripwire ?? state.lastStepResult?.tripwire,
                  maxSteps: state.options?.maxSteps ?? maxSteps,
                });
          if (state.modelSpanData) {
            const modelSpan =
              registry?.resumeModelSpan ??
              registry?.modelSpan ??
              (observability?.rebuildSpan(state.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION>) as
                | AIModelGenerationSpan
                | undefined);
            const toolCalls = state.accumulatedSteps.flatMap(step =>
              ((step.toolCalls ?? []) as DurableToolCallInput[]).map(tc => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              })),
            );
            const { usageIncomplete, usage } = generationUsage(state.accumulatedUsage, state.accumulatedSteps);
            modelSpan?.createTracker()?.endGeneration({
              ...termination,
              output: { text: finalText, ...(toolCalls.length ? { toolCalls } : {}) },
              attributes: {
                finishReason: state.lastStepResult?.reason || 'stop',
                ...(usageIncomplete ? { usageIncomplete: true } : {}),
                ...clocks,
                responseId: state.lastResponse?.id,
                responseModel: state.lastResponse?.modelId,
              },
              usage,
            });
          }

          // End AGENT_RUN span with final output
          if (state.agentSpanData) {
            const agentSpan =
              registry?.resumeAgentSpan ??
              registry?.agentSpan ??
              observability?.rebuildSpan(state.agentSpanData as ExportedSpan<SpanType.AGENT_RUN>);
            agentSpan?.end({
              ...termination,
              output: { text: finalText },
              ...(Object.keys(clocks).length ? { attributes: clocks } : {}),
            });
          }

          // Memory is saved above, so the deadline error goes out after the turn is stored. The caller's
          // process reports the same error at the deadline; its stream keeps one of them.
          if (pubsub && deadlineError) {
            await emitErrorEvent(pubsub, state.runId, deadlineError);
          } else if (pubsub) {
            await emitFinishEvent(pubsub, state.runId, {
              output: finalOutput.output,
              stepResult: finalOutput.stepResult,
              ...(textRewritten && { textRewritten }),
            });
          }

          return finalOutput;
        },
        { id: 'map-final-output' },
      )
      // Execute scorers (fire-and-forget, doesn't affect main result)
      .map(
        async params => {
          const { inputData, getInitData, mastra, requestContext, tracingContext } = params;
          const initData = getInitData() as DurableAgenticWorkflowInput;
          // This step's span is internal and has no live parent, so a score read from it
          // would name a span that is never stored.
          const registry = getRunRegistryEntry(initData.runId, mastra);
          const agentSpanData = registry?.resumeAgentSpanData ?? initData.agentSpanData;
          const agentSpan =
            registry?.resumeAgentSpan ??
            registry?.agentSpan ??
            (agentSpanData
              ? mastra?.observability
                  ?.getSelectedInstance({})
                  ?.rebuildSpan(agentSpanData as ExportedSpan<SpanType.AGENT_RUN>)
              : undefined);
          void executeDurableAgentScorers({
            initData,
            finalOutput: inputData,
            mastra,
            requestContext,
            tracingContext: agentSpan ? { currentSpan: agentSpan } : tracingContext,
            loadStoredMessages: loadRunStoredMessages(params),
            // Call-time and defaultOptions scorers are parked in-process by instance; name
            // resolution alone misses any scorer Mastra never registered (#27579).
            scorerInstances: takeRunScorerInstances(initData.runId, mastra),
          }).catch(error => mastra?.getLogger?.()?.warn?.(`[DurableAgent] Skipped scorers: ${error}`));

          return inputData;
        },
        { id: 'execute-scorers' },
      )
      .commit()
  );
}
