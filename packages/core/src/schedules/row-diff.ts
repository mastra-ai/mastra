import type { Schedule } from '../storage/domains/schedules/base';

/**
 * Comparators for deciding whether a stored schedule row still matches what
 * code declares. Shared by both declarative sync paths — workflow schedules
 * (`createWorkflow({ schedule })`) and file-based agent schedules — so the two
 * cannot drift on what counts as "unchanged" and start rewriting rows on every
 * boot.
 */

/**
 * Stable JSON-shape comparison for two `Schedule.target` values. Uses
 * JSON.stringify because targets are plain JSON-serializable objects (the
 * storage layer round-trips them through the same encoding). Covers the
 * `inputData` / `initialState` / `requestContext` payload fields that we
 * want to detect changes on across redeploys.
 */
export function targetsEqual(a: Schedule['target'] | undefined, b: Schedule['target']): boolean {
  if (a === b) return true;
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** See {@link targetsEqual}. Same approach for free-form metadata. */
export function metadataEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  const aNorm = a ?? undefined;
  const bNorm = b ?? undefined;
  if (aNorm === bNorm) return true;
  if (!aNorm || !bNorm) return false;
  return JSON.stringify(aNorm) === JSON.stringify(bNorm);
}
