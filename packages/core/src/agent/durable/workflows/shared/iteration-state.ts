import type { LanguageModelUsage, StepTripwireData } from '../../../../stream/types';
import type { DurableAgenticExecutionOutput, RunRegistryEntry } from '../../types';
import type { AccumulatedUsage, BaseIterationState } from './schemas';

interface SpanClocks {
  completionStartTime?: Date | string;
  timeToFirstTokenMs?: number;
}

/**
 * The first-chunk clocks for spans rebuilt from a run-start snapshot. A
 * resumed segment keeps them on the run registry beside its fresh spans; the
 * originals keep them in the loop state. Undefined when none was captured yet.
 */
export function carriedSpanClocks(
  registry:
    | Pick<RunRegistryEntry, 'resumeModelSpanData' | 'resumeCompletionStartTime' | 'resumeTimeToFirstTokenMs'>
    | undefined,
  state: SpanClocks,
): { completionStartTime?: Date; timeToFirstTokenMs?: number } | undefined {
  const clocks: SpanClocks = registry?.resumeModelSpanData
    ? { completionStartTime: registry.resumeCompletionStartTime, timeToFirstTokenMs: registry.resumeTimeToFirstTokenMs }
    : state;
  const attributes = {
    ...(clocks.completionStartTime ? { completionStartTime: new Date(clocks.completionStartTime) } : {}),
    ...(clocks.timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs: clocks.timeToFirstTokenMs } : {}),
  };
  return Object.keys(attributes).length ? attributes : undefined;
}

/**
 * Input for creating iteration state update
 */
export interface IterationStateUpdateInput {
  /** Current iteration state */
  currentState: BaseIterationState;
  /** Output from the current iteration's execution */
  executionOutput: DurableAgenticExecutionOutput;
}

/**
 * Step record for tracking iteration history.
 *
 * Main accumulates full `DefaultStepResult` objects; durable serializes this
 * reduced record across step boundaries instead. `content` is the step's model
 * content, the same value stopWhen and `stream.steps` see. It is absent on
 * records written before it was added, where `buildDurableStepContent`
 * rebuilds it from `text`/`toolCalls`/`toolResults`. Other fields of
 * `DefaultStepResult` (`response`, etc.) are still not carried.
 */
export interface StepRecord {
  text?: string;
  content?: unknown[];
  toolCalls?: unknown[];
  toolResults?: unknown[];
  usage?: LanguageModelUsage;
  finishReason?: string;
  tripwire?: StepTripwireData;
}

/**
 * Calculate accumulated usage from current state and new execution output.
 */
export function calculateAccumulatedUsage(
  currentUsage: AccumulatedUsage,
  executionUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    cacheCreationInputTokens?: number;
    reasoningTokens?: number;
  },
): AccumulatedUsage {
  const accumulate = (current: number | undefined, next: number | undefined) =>
    current !== undefined && next !== undefined ? current + next : undefined;

  const usage: AccumulatedUsage = {
    inputTokens: accumulate(currentUsage.inputTokens, executionUsage?.inputTokens),
    outputTokens: accumulate(currentUsage.outputTokens, executionUsage?.outputTokens),
    totalTokens: accumulate(currentUsage.totalTokens, executionUsage?.totalTokens),
  };
  // Only emit detail fields once some step reported them, so providers without caching don't show a misleading 0
  for (const key of ['cachedInputTokens', 'cacheCreationInputTokens', 'reasoningTokens'] as const) {
    const current = currentUsage[key];
    const step = executionUsage?.[key];
    if (current !== undefined || step !== undefined) {
      usage[key] = (current ?? 0) + (step ?? 0);
    }
  }
  return usage;
}

/**
 * Build a step record from execution output.
 */
export function buildStepRecord(executionOutput: DurableAgenticExecutionOutput): StepRecord {
  return {
    text: executionOutput.output.text,
    content: executionOutput.output.content,
    toolCalls: executionOutput.output.toolCalls,
    toolResults: executionOutput.toolResults,
    usage: executionOutput.output.usage,
    finishReason: executionOutput.stepResult.reason,
    tripwire: executionOutput.stepResult.tripwire,
  };
}

/**
 * An output processor can hold a tool result past its tool-call step and emit
 * it when a later stream ends. The tool-call step recorded it as hidden; now
 * that it was emitted, callbacks report it again.
 */
function withReleasedToolResults<T extends StepRecord>(steps: T[], released?: string[]): T[] {
  if (!released?.length) return steps;
  const ids = new Set(released);
  return steps.map(step => {
    if (!step.toolResults?.some(result => isHeldResult(result, ids))) return step;
    return {
      ...step,
      toolResults: step.toolResults.map(result => {
        if (!isHeldResult(result, ids)) return result;
        const { resultHidden: _resultHidden, ...rest } = result as { resultHidden?: boolean };
        return rest;
      }),
    };
  });
}

function isHeldResult(result: unknown, ids: Set<string>): boolean {
  const record = result as { toolCallId?: string; resultHidden?: boolean } | undefined;
  return !!record?.resultHidden && !!record.toolCallId && ids.has(record.toolCallId);
}

/**
 * Create the base iteration state update.
 *
 * This returns the common fields for iteration state updates.
 * Implementations can extend this with their specific fields.
 *
 * @example
 * ```typescript
 * const baseUpdate = createBaseIterationStateUpdate({
 *   currentState: initData,
 *   executionOutput,
 * });
 *
 * // Core extends with modelList
 * const coreState = { ...baseUpdate, modelList: initData.modelList };
 *
 * // Inngest extends with observability
 * const inngestState = {
 *   ...baseUpdate,
 *   agentSpanData: initData.agentSpanData,
 *   modelSpanData: initData.modelSpanData,
 *   stepIndex: initData.stepIndex + 1,
 * };
 * ```
 */
export function createBaseIterationStateUpdate(input: IterationStateUpdateInput): BaseIterationState {
  const { currentState, executionOutput } = input;

  // Legacy states with completed steps cannot prove whether their numeric totals
  // include every provider measurement. Preserve the zero identity only for a
  // pre-first-step state; otherwise migrate the accumulator to unknown.
  const currentUsage =
    currentState.usageAggregationVersion === 1 || currentState.accumulatedSteps.length === 0
      ? currentState.accumulatedUsage
      : {
          ...currentState.accumulatedUsage,
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        };
  const signalPreempted = executionOutput.stepResult.signalPreempted === true;
  const newUsage = signalPreempted
    ? currentState.accumulatedUsage
    : calculateAccumulatedUsage(currentUsage, executionOutput.output.usage);
  const lastStepResult = { ...executionOutput.stepResult };
  delete lastStepResult.request;

  return {
    runId: currentState.runId,
    agentId: currentState.agentId,
    agentName: currentState.agentName,
    messageListState: executionOutput.messageListState,
    initialUntaggedSystemMessages: currentState.initialUntaggedSystemMessages,
    toolsMetadata: currentState.toolsMetadata,
    modelConfig: currentState.modelConfig,
    options: currentState.options,
    state: executionOutput.state,
    messageId: executionOutput.messageId,
    // Carried, not recomputed: the request context is fixed for the run, and
    // the steps that rebuild from Mastra have no other source for it.
    requestContextEntries: currentState.requestContextEntries,
    inputTripwire: signalPreempted ? currentState.inputTripwire : undefined,
    iterationCount: currentState.iterationCount + (signalPreempted ? 0 : 1),
    accumulatedSteps: signalPreempted
      ? currentState.accumulatedSteps
      : [
          ...withReleasedToolResults(currentState.accumulatedSteps, executionOutput.releasedToolResultIds),
          buildStepRecord(executionOutput),
        ],
    accumulatedUsage: newUsage,
    usageAggregationVersion: signalPreempted ? currentState.usageAggregationVersion : 1,
    lastStepResult,
    deferredStepFinishChunk: executionOutput.deferredStepFinishChunk,
    backgroundTaskPending: executionOutput.backgroundTaskPending,
    delegationBailed: executionOutput.delegationBailed,
    // Preserve the two-phase stop flag set by the dowhile predicate's
    // onIterationComplete handler.  The predicate mutates state on the
    // *output* of the previous iteration; createBaseIterationStateUpdate
    // rebuilds the state for the next iteration, so we must carry the
    // flag forward explicitly.
    pendingFeedbackStop: currentState.pendingFeedbackStop,
    // Carry span identity forward unchanged so every iteration shares one trace.
    agentSpanData: currentState.agentSpanData,
    modelSpanData: currentState.modelSpanData,
    // First inference wins; later iterations never overwrite it.
    completionStartTime: currentState.completionStartTime ?? executionOutput.completionStartTime,
    timeToFirstTokenMs: currentState.timeToFirstTokenMs ?? executionOutput.timeToFirstTokenMs,
  };
}
