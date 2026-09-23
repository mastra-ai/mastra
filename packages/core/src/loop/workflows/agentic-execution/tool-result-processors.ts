import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, Processor } from '../../../processors';
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
 * registered on both sides runs once per tool result. Matching is by object
 * identity, never by `id`: `id` is a public, user-chosen string that distinct
 * instances routinely share (every `new TokenLimiterProcessor()` reports
 * `'token-limiter'`). Matching on it would drop an input instance configured
 * with `maxToolResultTokens` because an unrelated output instance happened to
 * share the name.
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
  // both sides is only reachable through the instances the workflow recorded for its steps.
  const outputProcessorInstances = new Set<Processor>(
    (outputProcessors ?? []).flatMap(processor =>
      isProcessorWorkflow(processor) ? (processor.__sourceProcessors ?? []) : [processor as Processor],
    ),
  );

  const seen = new Set<Processor>();
  const selected: InputProcessorOrWorkflow[] = [];

  for (const processor of candidates) {
    if (isProcessorWorkflow(processor)) continue;
    if (!processor.processToolResult) continue;
    if (outputProcessorInstances.has(processor as Processor)) continue;
    if (seen.has(processor as Processor)) continue;
    seen.add(processor as Processor);
    selected.push(processor);
  }

  return selected;
}
