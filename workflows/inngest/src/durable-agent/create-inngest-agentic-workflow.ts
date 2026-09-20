import { createHash } from 'node:crypto';
import {
  createDurableBackgroundTaskCheckStep,
  createDurableLLMExecutionStep,
  createDurableLLMMappingStep,
  createDurableSignalDrainStep,
  createDurableToolCallStep,
  DurableAgentDefaults,
  DurableStepIds,
  AGENT_CONTROL_TOPIC,
  ensureRemoteAbortListener,
  createTerminalToolResultEnvelope,
  emitChunkEvent,
  emitFinishEvent,
  executeDurableAgentScorers,
  runDurableFinishSideEffects,
  modelConfigSchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
  getBoundRunRegistryEntry,
  mapDurableIterationToLLMInput,
  resolveDurableToolCallConcurrency,
  TOOL_PERMISSION_POLICY_KEY,
  TOOL_PERMISSION_POLICY_REQUIRED_KEY,
  TOOL_PERMISSION_POLICY_STABLE_KEY,
} from '@mastra/core/agent/durable';
import type {
  DurableToolPermissionResolver,
  DurableAgenticExecutionOutput,
  DurableAgenticWorkflowInput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
  DurableToolCallInput,
  ToolPermissionPolicy,
} from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import { SpanType, InternalSpans } from '@mastra/core/observability';
import type { AIModelGenerationSpan, ExportedSpan } from '@mastra/core/observability';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Inngest } from 'inngest';
import { z } from 'zod';

import { init } from '../index';

/**
 * Input schema for the durable agentic workflow.
 * Extends base with observability fields for Inngest.
 */
const durableAgenticInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // JSON-safe snapshot of the caller's request context. Inngest runs durable
  // steps on a separate worker process, so this snapshot is the only way the
  // rebuild path can recover request-scoped configuration.
  requestContextEntries: z.record(z.string(), z.any()).optional(),
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
  /**
   * Workflow IDs used by the parent agentic loop and its nested execution
   * workflow. Direct factory callers retain the historical shared IDs when
   * this option is omitted.
   */
  workflowIds?: InngestDurableAgenticWorkflowIds;
  /**
   * Trusted worker-local policy resolver. The function is captured by the
   * registered Inngest worker and is never serialized into workflow state.
   */
  resolveToolPermission?: DurableToolPermissionResolver;
}

/**
 * Iteration state schema - extends base with observability fields.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
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
/**
 * Durable-agent wire/function protocol. Function IDs include this version so
 * a pre-policy worker cannot claim an event whose authorization markers it
 * does not understand. v4 adds the action-time `onBeforeToolExecution`
 * requirement marker — a v3 worker would ignore it and execute
 * hook-protected calls without revalidation. Deploy v4 only after in-flight
 * v3 runs have drained, or keep v3 workers available until those runs and
 * suspended snapshots finish.
 */
export const INNGEST_DURABLE_AGENT_PROTOCOL_VERSION = 'v4' as const;

/** Prefix for Inngest engine workflow IDs to avoid collision with other engines and protocol versions. */
const INNGEST_ENGINE_PREFIX = `inngest:${INNGEST_DURABLE_AGENT_PROTOCOL_VERSION}`;

/** Inngest-prefixed workflow IDs */
export const InngestDurableStepIds = {
  AGENTIC_EXECUTION: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_EXECUTION}`,
  AGENTIC_LOOP: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_LOOP}`,
} as const;

export interface InngestDurableAgenticWorkflowIds {
  AGENTIC_EXECUTION: string;
  AGENTIC_LOOP: string;
}

const INNGEST_RESPONSE_RECOVERY_UNSUPPORTED_MESSAGE =
  'Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0';

/**
 * Fail before dispatch or provider I/O when a caller requests the live,
 * response-only recovery capability. Inngest may resume on another worker and
 * cannot preserve the process-local one-shot admission that authorizes it.
 */
export function assertInngestResponseRecoveryDisabled(options: unknown): void {
  const recoveryMaxSteps =
    options && typeof options === 'object' ? (options as { recoveryMaxSteps?: unknown }).recoveryMaxSteps : undefined;
  if (recoveryMaxSteps !== undefined && recoveryMaxSteps !== 0) {
    throw new TypeError(INNGEST_RESPONSE_RECOVERY_UNSUPPORTED_MESSAGE);
  }
}

/**
 * Derive collision-safe workflow IDs for one public durable-agent ID.
 *
 * Both IDs must share the same owner suffix: the loop is registered as an
 * Inngest function while the execution workflow is recursively exposed as a
 * nested function. Changing only the parent would leave nested functions from
 * different durable agents aliased to the same Inngest function ID.
 *
 * The protocol prefix, hash input, and width are a persisted routing contract.
 * A protocol change intentionally produces new Inngest function IDs. Keep the
 * prior worker deployment running long enough to drain pre-upgrade runs; a v2
 * wrapper doesn't resume a v1 snapshot under a different function identity.
 */
export function createInngestDurableAgenticWorkflowIds(agentId: string): InngestDurableAgenticWorkflowIds {
  if (!agentId) {
    throw new TypeError('Inngest durable-agent workflow IDs require a non-empty agent ID');
  }

  const ownerHash = createHash('sha256')
    .update(`mastra:inngest:durable-agent:${INNGEST_DURABLE_AGENT_PROTOCOL_VERSION}\0${agentId}`)
    .digest('hex')
    .slice(0, 32);

  return {
    AGENTIC_EXECUTION: `${InngestDurableStepIds.AGENTIC_EXECUTION}:${ownerHash}`,
    AGENTIC_LOOP: `${InngestDurableStepIds.AGENTIC_LOOP}:${ownerHash}`,
  };
}

export function createInngestDurableAgenticWorkflow(options: InngestDurableAgenticWorkflowOptions) {
  const {
    inngest,
    maxSteps = DurableAgentDefaults.MAX_STEPS,
    workflowIds = InngestDurableStepIds,
    resolveToolPermission,
  } = options;
  const { createWorkflow } = init(inngest);

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the tool call step - each tool call runs as its own step with suspend support
  const toolCallStep = createDurableToolCallStep({ resolveToolPermission });

  // Create the LLM mapping step - reuse from core
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the background task check step
  const backgroundTaskCheckStep = createDurableBackgroundTaskCheckStep();

  // Drain active-run signals after tools/background work settle. A signal
  // wins over a terminal candidate and forces one provider continuation.
  const signalDrainStep = createDurableSignalDrainStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  const singleIterationWorkflow = createWorkflow({
    id: workflowIds.AGENTIC_EXECUTION,
    inputSchema: iterationStateSchema,
    outputSchema: iterationStateSchema,
    options: {
      tracingPolicy: {
        // Mark all workflow spans as internal so they're hidden in traces
        // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
    steps: [],
  })
    // Step 0: Convert iteration state to LLM input format
    .map(
      async ({ inputData }) => {
        const state = inputData as IterationState;
        return mapDurableIterationToLLMInput(state);
      },
      { id: 'map-to-llm-input' },
    )
    // Step 1: Execute LLM
    .then(llmExecutionStep)
    // Step 2: Extract tool calls as array for foreach (forward model_step span for nesting)
    .map(
      async ({ inputData, getInitData }) => {
        const llmOutput = inputData as DurableLLMStepOutput;
        const iterationCount = (getInitData() as IterationState).iterationCount;
        return (llmOutput.toolCalls ?? []).map(toolCall => ({
          ...toolCall,
          iterationCount,
          stepSpanData: llmOutput.stepSpanData,
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
      concurrency: ({ inputData, getInitData, requestContext }) => {
        const state = getInitData() as IterationState | undefined;
        // The worker resolver may be async and may distinguish a fresh call
        // from a resume, while foreach concurrency resolution is synchronous
        // and has no resume phase. It therefore remains sequential. A live
        // immutable RequestContext snapshot can still unlock all-allow batches
        // through the same shared classifier as core durable execution.
        if (resolveToolPermission) return 1;
        const policyCandidate = requestContext?.get(TOOL_PERMISSION_POLICY_KEY);
        const permissionPolicy =
          typeof policyCandidate === 'function' ? (policyCandidate as ToolPermissionPolicy) : undefined;
        return resolveDurableToolCallConcurrency({
          options: state?.options,
          toolsMetadata: state?.toolsMetadata,
          toolCalls: inputData as DurableToolCallInput[],
          permissionPolicy: permissionPolicy ? toolCall => permissionPolicy(toolCall.toolName) : undefined,
          permissionPolicyStable: requestContext?.get(TOOL_PERMISSION_POLICY_STABLE_KEY) === true,
          permissionPolicyRequired:
            state?.options.permissionPolicyRequired === true ||
            requestContext?.get(TOOL_PERMISSION_POLICY_REQUIRED_KEY) === true,
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
    // Step 6.5: A queued signal supersedes direct terminal delivery.
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

        // Extend with Inngest-specific observability fields
        const newIterationState: IterationState = {
          ...baseUpdate,
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
    .commit();

  // Create the main agentic loop workflow with dowhile
  return (
    createWorkflow({
      id: workflowIds.AGENTIC_LOOP,
      inputSchema: durableAgenticInputSchema,
      outputSchema: durableAgenticOutputSchema,
      options: {
        tracingPolicy: {
          // Mark all workflow spans as internal so they're hidden in traces
          // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
          internal: InternalSpans.WORKFLOW,
        },
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
        validateInputs: false,
      },
      steps: [],
    })
      // Initialize iteration state from input
      // The AGENT_RUN span is created BEFORE the workflow starts (in InngestAgent.stream)
      // and passed via input.agentSpanData so the agent_run is the root of the trace
      .map(
        async ({ inputData }) => {
          const input = inputData as DurableAgenticWorkflowInput;
          assertInngestResponseRecoveryDisabled(input.options);

          // Use the agent span data passed from InngestAgent.stream()
          // This span was created before the workflow started, making it the trace root
          const agentSpanData = input.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined;
          // Use the model span data passed from InngestAgent.stream()
          // This ensures ONE model_generation span contains all steps (like regular agents)
          const modelSpanData = input.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;

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
        const { inputData } = params;
        const state = inputData as IterationState;
        const initData = params.getInitData() as DurableAgenticWorkflowInput;
        const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

        if (getBoundRunRegistryEntry(state.runId, initData.runtimeBindingId)?.abortSignal?.aborted) {
          state.terminalToolResult = undefined;
          state.deferredStepFinishChunk = undefined;
          if (state.lastStepResult) {
            state.lastStepResult.reason = 'abort';
            state.lastStepResult.isContinued = false;
          }
          return false;
        }

        // Flush ordinary intermediate step-finish chunks here. Terminal data
        // stays in state until the memoized final map: Inngest may re-evaluate
        // a loop condition during replay, and caller-facing output must not be
        // published from that replayable predicate.
        if (pubsub && !state.terminalToolResult) {
          if (state.deferredStepFinishChunk) {
            await emitChunkEvent(pubsub, state.runId, state.deferredStepFinishChunk as any);
          }
          state.deferredStepFinishChunk = undefined;
        }

        if (state.terminalToolResult) {
          if (state.lastStepResult) state.lastStepResult.isContinued = false;
          return false;
        }

        // Check if we should continue
        const shouldContinue = state.lastStepResult?.isContinued === true;
        // Use maxSteps from options (per-request), falling back to workflow-level default
        const effectiveMaxSteps = state.options?.maxSteps ?? maxSteps;
        const underMaxSteps = state.iterationCount < effectiveMaxSteps;

        return shouldContinue && underMaxSteps;
      })
      // Map final state to output format, close agent span, and emit finish event
      .map(
        async params => {
          const { inputData, mastra, requestContext, tracingContext } = params;
          const state = inputData as IterationState;
          const initData = params.getInitData() as DurableAgenticWorkflowInput;
          getBoundRunRegistryEntry(state.runId, initData.runtimeBindingId);
          const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

          // This final map is an independently scheduled Inngest operation and
          // can run on a worker that never executed the preceding LLM/tool
          // steps. Install the replay listener before deciding terminal
          // authority so a queued abort still wins.
          if (pubsub) {
            try {
              await ensureRemoteAbortListener(pubsub, state.runId, initData.runtimeBindingId);
            } catch (error) {
              mastra?.getLogger?.()?.warn?.('Failed to subscribe to cross-process abort requests', {
                runId: state.runId,
                error: error instanceof Error ? error.message : String(error),
              });
              // Terminal publication must not continue without replaying any
              // retained abort request. Throw so Inngest retries this memoized
              // operation before FINISH and binding-scoped cleanup commit.
              throw error;
            }
          }

          // Abort may land after the loop predicate but before this final map.
          // It still wins over the not-yet-published terminal candidate.
          if (getBoundRunRegistryEntry(state.runId, initData.runtimeBindingId)?.abortSignal?.aborted) {
            state.terminalToolResult = undefined;
            state.deferredStepFinishChunk = undefined;
            if (state.lastStepResult) {
              state.lastStepResult.reason = 'abort';
              state.lastStepResult.isContinued = false;
            }
          }

          // Extract final text from last step
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          let finalText = lastStep?.text;

          // Establish terminal authority before any processor, persistence, or title side effect.
          const terminalEnvelope = state.terminalToolResult
            ? createTerminalToolResultEnvelope(state.runId, state.accumulatedSteps.length, state.terminalToolResult)
            : undefined;
          if (terminalEnvelope) {
            state.terminalToolResult = terminalEnvelope.data;
          }

          // This map callback already runs inside the execution engine's
          // durable step. Nesting another Inngest step.run here is rejected by
          // connect workers and can strand the caller before the finish event.
          const finishResult = await runDurableFinishSideEffects({
            runId: state.runId,
            initData,
            messageListState: state.messageListState,
            mastra,
            requestContext,
            tracingContext,
            logger: mastra?.getLogger?.(),
            outputResult: {
              text: finalText ?? '',
              usage: state.accumulatedUsage,
              finishReason: state.lastStepResult?.reason ?? 'unknown',
              steps: state.accumulatedSteps,
            },
            terminalEnvelope,
            messageId: state.messageId,
          });
          state.messageListState = finishResult.messageListState;
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
            ...(state.terminalToolResult ? { terminalToolResult: state.terminalToolResult } : {}),
          };

          // End MODEL_GENERATION span with final output (children before parent)
          // This span was created BEFORE the workflow started and stayed open for all iterations.
          // Same shape as the core durable agent: `text` is the output, usage goes to the
          // attributes through the tracker so consumers find it where every other model span puts it.
          const observability = mastra?.observability?.getSelectedInstance({});
          if (state.modelSpanData) {
            const modelSpan = observability?.rebuildSpan(
              state.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION>,
            ) as AIModelGenerationSpan | undefined;
            modelSpan?.createTracker()?.endGeneration({
              output: { text: finalText },
              attributes: { finishReason: state.lastStepResult?.reason || 'stop' },
              usage: state.accumulatedUsage,
            });
          }

          // End AGENT_RUN span with final output
          if (state.agentSpanData) {
            const agentSpan = observability?.rebuildSpan(state.agentSpanData as ExportedSpan<SpanType.AGENT_RUN>);
            agentSpan?.end({ output: { text: finalText } });
          }

          // Emit finish event via pubsub
          if (pubsub) {
            const deferredTerminalStep = terminalEnvelope ? state.deferredStepFinishChunk : undefined;
            const terminalStepFinishChunk =
              deferredTerminalStep && typeof deferredTerminalStep === 'object'
                ? {
                    ...deferredTerminalStep,
                    payload: {
                      ...((deferredTerminalStep as { payload?: object }).payload ?? {}),
                      messageId: state.messageId,
                    },
                  }
                : deferredTerminalStep;
            if (terminalEnvelope) state.deferredStepFinishChunk = undefined;
            await emitFinishEvent(pubsub, state.runId, {
              output: finalOutput.output,
              stepResult: finalOutput.stepResult,
              ...(terminalEnvelope ? { terminalToolResult: terminalEnvelope } : {}),
              ...(terminalStepFinishChunk ? { terminalStepFinishChunk: terminalStepFinishChunk as any } : {}),
            });
          }

          return finalOutput;
        },
        { id: 'map-final-output' },
      )
      // `map-final-output` must be durably acknowledged before removing the
      // replayed abort. If a worker dies after publishing FINISH but before
      // that map commits, its retry still needs the tombstone to preserve the
      // aborted outcome. This separate memoized operation is idempotent.
      .map(
        async params => {
          const initData = params.getInitData() as DurableAgenticWorkflowInput;
          if (!initData.runtimeBindingId) return params.inputData;
          try {
            getBoundRunRegistryEntry(initData.runId, initData.runtimeBindingId);
          } catch {
            // A newer execution owns this reused run ID. The old cleanup is an
            // idempotent no-op and must not fail terminalized work.
            return params.inputData;
          }
          const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
          if (pubsub) {
            await pubsub.clearTopicOrThrow(AGENT_CONTROL_TOPIC(initData.runId, initData.runtimeBindingId));
          }
          return params.inputData;
        },
        { id: 'clear-agent-control-topic' },
      )
      // Execute scorers (fire-and-forget, doesn't affect main result)
      .map(
        async ({ inputData, getInitData, mastra, requestContext, tracingContext }) => {
          executeDurableAgentScorers({
            initData: getInitData() as DurableAgenticWorkflowInput,
            finalOutput: inputData,
            mastra,
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
