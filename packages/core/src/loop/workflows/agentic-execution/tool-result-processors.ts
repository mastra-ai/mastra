import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../../../processors';
import { isProcessorWorkflow } from '../../../processors/index';

/**
 * Select the input-registered processors that should also fire during the
 * tool-result phase.
 *
 * Agent-level `inputProcessors` are combined into a single processor workflow
 * before reaching the loop, so the raw processor instances are only reachable
 * through the uncombined `llmRequestInputProcessors` list. We therefore only
 * consider plain (non-workflow) processors here — running the combined input
 * workflow again in the tool-result phase would re-run unrelated input steps.
 *
 * Processors already present in `outputProcessors` are dropped so a processor
 * registered on both sides runs once per tool result.
 */
export function getToolResultInputProcessors({
  inputProcessors,
  llmRequestInputProcessors,
  outputProcessors,
}: {
  inputProcessors?: InputProcessorOrWorkflow[];
  llmRequestInputProcessors?: InputProcessorOrWorkflow[];
  outputProcessors?: OutputProcessorOrWorkflow[];
}): InputProcessorOrWorkflow[] {
  const candidates = [...(llmRequestInputProcessors ?? []), ...(inputProcessors ?? [])];
  if (!candidates.length) return [];

  // Output processors are combined into a workflow too, so a processor registered on
  // both sides is only recognizable through the ids the workflow records for its steps.
  const outputProcessorIds = new Set(
    (outputProcessors ?? []).flatMap(processor =>
      isProcessorWorkflow(processor) ? (processor.__sourceProcessorIds ?? []) : [processor.id],
    ),
  );

  const seen = new Set<string>();
  const selected: InputProcessorOrWorkflow[] = [];

  for (const processor of candidates) {
    if (isProcessorWorkflow(processor)) continue;
    if (!processor.processToolResult) continue;
    if (outputProcessorIds.has(processor.id)) continue;
    if (seen.has(processor.id)) continue;
    seen.add(processor.id);
    selected.push(processor);
  }

  return selected;
}
