import type { DurableAgenticWorkflowOptions } from './durable-loop-builder';
import { DurableAgenticLoopBuilder } from './durable-loop-builder';

export type { DurableAgenticWorkflowOptions } from './durable-loop-builder';

/**
 * Composes the durable agentic workflow. The topology, workflow options, and
 * continuation predicate live on `DurableAgenticLoopBuilder` (which shares its
 * shape with the main loop's `AgenticLoopBuilder`); this wrapper preserves the
 * existing call surface.
 *
 * Note: tools and model are resolved from Mastra at runtime, so this workflow
 * is created once at startup and reused for all runs.
 */
export function createDurableAgenticWorkflow(options?: DurableAgenticWorkflowOptions) {
  return new DurableAgenticLoopBuilder(options).build();
}
