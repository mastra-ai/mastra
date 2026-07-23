/**
 * Shared typed walker over a serialized workflow graph. Every consumer that
 * needs "all the leaf entries in this graph" (schema validation, reference
 * validation, nested-workflow dependency collection) goes through this one
 * function, so recursion into container entries lives in exactly one place
 * and is exhaustiveness-checked against `SerializedStepFlowEntry`.
 */
import type { SerializedSingleStepEntry, SerializedStepFlowEntry } from '../types';

/**
 * Invoke `visit` for every single-step (leaf) entry in the graph, recursing
 * into `parallel`/`conditional` children and `loop`/`foreach` bodies.
 *
 * Does NOT recurse into a nested workflow's inlined `serializedStepFlow` —
 * a nested workflow's own graph is validated when that workflow is added.
 * `sleep`/`sleepUntil` entries carry no references or schemas and are skipped.
 */
export function forEachSingleStepEntry(
  entries: readonly SerializedStepFlowEntry[],
  visit: (entry: SerializedSingleStepEntry) => void,
): void {
  for (const entry of entries) {
    switch (entry.type) {
      case 'step':
      case 'agent':
      case 'tool':
      case 'mapping':
      case 'workflow':
        visit(entry);
        break;
      case 'parallel':
      case 'conditional':
        entry.steps.forEach(visit);
        break;
      case 'loop':
      case 'foreach':
        visit(entry.step);
        break;
      case 'sleep':
      case 'sleepUntil':
        break;
      default: {
        const _exhaustive: never = entry;
        void _exhaustive;
      }
    }
  }
}
