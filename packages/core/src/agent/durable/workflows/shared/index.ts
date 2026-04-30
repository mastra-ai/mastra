/**
 * Shared utilities for durable agentic workflows
 *
 * This module contains code shared between:
 * - Core DurableAgent workflow
 * - Inngest durable agent workflow
 * - Evented durable agent workflow
 */

export { executeDurableToolCalls } from './execute-tool-calls';
export type { ToolExecutionContext, ToolExecutionError } from './execute-tool-calls';

export {
  modelConfigSchema,
  modelListEntrySchema,
  accumulatedUsageSchema,
  durableAgenticOutputSchema,
  baseDurableAgenticInputSchema,
  baseIterationStateSchema,
} from './schemas';
export type { BaseIterationState, AccumulatedUsage } from './schemas';

export { calculateAccumulatedUsage, buildStepRecord, createBaseIterationStateUpdate } from './iteration-state';
export type { IterationStateUpdateInput, StepRecord } from './iteration-state';
