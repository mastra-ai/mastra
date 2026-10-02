import type { ToolSet } from '@internal/ai-sdk-v5';
import { AgenticLoopBuilder } from '../../loop-builder';
import type { OuterLLMRun } from '../../types';

export { AGENTIC_EXECUTION_WORKFLOW_ID } from '../../loop-builder';

/**
 * Composes the single-iteration execution workflow (LLM execution → tool-call
 * foreach → mapping → background check → signal drain → isTaskComplete →
 * goal). The topology lives on `AgenticLoopBuilder` (loop/loop-builder.ts);
 * this wrapper preserves the existing call surface.
 */
export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>(
  params: OuterLLMRun<Tools, OUTPUT>,
) {
  return new AgenticLoopBuilder<Tools, OUTPUT>(params).buildIterationWorkflow();
}
