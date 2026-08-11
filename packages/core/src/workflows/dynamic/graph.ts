/**
 * Shared typed walker over a serialized workflow graph. Every consumer that
 * needs "all the leaf entries in this graph" (schema validation, reference
 * validation, nested-workflow dependency collection) goes through this one
 * function, so recursion into container entries lives in exactly one place
 * and is exhaustiveness-checked against `SerializedStepFlowEntry`.
 */
import type { SerializedSingleStepEntry, SerializedStepFlowEntry } from '../types';
import type { ValidatableStepFlowEntry } from './validate/types';

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

/**
 * Collect the ids of every nested workflow referenced by a stored graph.
 * Used by boot-time loading to hydrate stored definitions in dependency order.
 */
export function collectNestedWorkflowIds(graph: readonly SerializedStepFlowEntry[]): Set<string> {
  const out = new Set<string>();
  forEachSingleStepEntry(graph, entry => {
    if (entry.type === 'workflow') out.add(entry.workflowId);
  });
  return out;
}

/**
 * Same traversal as {@link forEachSingleStepEntry} but reports each leaf's
 * position as a dotted path (`graph.2`, `graph.2.steps.0`, `graph.2.step`) —
 * the path contract shared by validation issues and the Studio draft UI.
 *
 * Accepts the wider {@link ValidatableStepFlowEntry} union so both persisted
 * graphs and wire-shaped authoring submissions can be walked.
 */
export function forEachSingleStepEntryWithPath(
  entries: readonly ValidatableStepFlowEntry[],
  visit: (entry: SerializedSingleStepEntry, path: string) => void,
): void {
  entries.forEach((entry, index) => {
    const path = `graph.${index}`;
    switch (entry.type) {
      case 'step':
      case 'agent':
      case 'tool':
      case 'mapping':
      case 'workflow':
        visit(entry, path);
        break;
      case 'parallel':
      case 'conditional':
        entry.steps.forEach((child, childIndex) => visit(child, `${path}.steps.${childIndex}`));
        break;
      case 'loop':
      case 'foreach':
        visit(entry.step, `${path}.step`);
        break;
      case 'sleep':
      case 'sleepUntil':
        break;
      default: {
        const _exhaustive: never = entry;
        void _exhaustive;
      }
    }
  });
}
