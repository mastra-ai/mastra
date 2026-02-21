import type { DurableAgenticExecutionOutput } from '../../types';
import type { AccumulatedUsage, BaseIterationState } from './schemas';

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
 * Step record for tracking iteration history
 */
export interface StepRecord {
  text?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  usage?: unknown;
  finishReason?: string;
}

/**
 * Calculate accumulated usage from current state and new execution output.
 */
export function calculateAccumulatedUsage(
  currentUsage: AccumulatedUsage,
  executionUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
): AccumulatedUsage {
  return {
    inputTokens: currentUsage.inputTokens + (executionUsage?.inputTokens || 0),
    outputTokens: currentUsage.outputTokens + (executionUsage?.outputTokens || 0),
    totalTokens: currentUsage.totalTokens + (executionUsage?.totalTokens || 0),
  };
}

/**
 * Build a step record from execution output.
 */
export function buildStepRecord(executionOutput: DurableAgenticExecutionOutput): StepRecord {
  return {
    text: executionOutput.output.text,
    toolCalls: executionOutput.output.toolCalls,
    toolResults: executionOutput.toolResults,
    usage: executionOutput.output.usage,
    finishReason: executionOutput.stepResult.reason,
  };
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

  const newUsage = calculateAccumulatedUsage(currentState.accumulatedUsage, executionOutput.output.usage);
  const stepRecord = buildStepRecord(executionOutput);

  return {
    runId: currentState.runId,
    agentId: currentState.agentId,
    agentName: currentState.agentName,
    messageListState: executionOutput.messageListState,
    toolsMetadata: currentState.toolsMetadata,
    modelConfig: currentState.modelConfig,
    options: currentState.options,
    state: executionOutput.state,
    messageId: executionOutput.messageId,
    iterationCount: currentState.iterationCount + 1,
    accumulatedSteps: [...currentState.accumulatedSteps, stepRecord],
    accumulatedUsage: newUsage,
    lastStepResult: executionOutput.stepResult,
  };
}
