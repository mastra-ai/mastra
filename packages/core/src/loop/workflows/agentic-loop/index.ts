import type { ToolSet } from '@internal/ai-v7';
import type { AgenticLoopBuilderParams } from '../../loop-builder';
import { AgenticLoopBuilder } from '../../loop-builder';

/**
 * Composes the main-loop agentic workflow. The topology and continuation
 * predicate live on `AgenticLoopBuilder` (loop/loop-builder.ts); this wrapper
 * preserves the existing call surface.
 */
export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: AgenticLoopBuilderParams<Tools, OUTPUT>,
) {
  return new AgenticLoopBuilder<Tools, OUTPUT>(params).build();
}
