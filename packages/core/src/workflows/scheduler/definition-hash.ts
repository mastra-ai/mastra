import { createHash } from 'node:crypto';

/**
 * Computes a stable content hash of a workflow's serialized step graph.
 *
 * Written onto declarative schedule rows (`WorkflowScheduleTarget.definitionHash`)
 * by `Mastra.registerDeclarativeSchedules()` and compared at claim time by the
 * scheduler so that an instance running a *different* build of the workflow
 * (a not-yet-cycled straggler from a previous deploy) refuses to claim the
 * fire and leaves it for an instance whose local definition matches the row.
 *
 * Scheduled runs execute `localOnly` in the claiming process against its own
 * workflow registry, so without this fence a stale instance silently runs an
 * outdated step graph (see #19169).
 *
 * Returns `undefined` when the graph is missing or not JSON-serializable —
 * callers treat a missing hash as "unfenced" (fail open) so legacy rows and
 * imperative schedules keep firing.
 */
export function computeScheduleDefinitionHash(serializedStepGraph: unknown): string | undefined {
  if (serializedStepGraph == null) return undefined;
  try {
    const json = JSON.stringify(serializedStepGraph);
    if (!json || json === '[]' || json === '{}') return undefined;
    return createHash('sha256').update(json).digest('hex').slice(0, 16);
  } catch {
    return undefined;
  }
}
