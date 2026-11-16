/**
 * The `autoResumeSuspendedTools` a suspended agentic-loop run executed its latest segment with: the value persisted
 * with its most recent suspension. A resume can override the run's setting, so a resume in another process (or after
 * a restart) that leaves the option out keeps the latest one, not the one the first parked tool call recorded.
 * (#30190)
 *
 * Each tool call that suspends persists the segment's value in its own suspend payload, with its `suspendedAt`.
 * Tool calls that suspend side by side keep one record each: under `__workflow_meta.foreachOutput` on the default and
 * durable engines, and as the step's `output` on the evented engine. The step's own suspend payload mirrors only the
 * first suspended call, so a step with per-call records is read through those records. A snapshot written before the
 * value was persisted has none, and this returns `undefined`.
 */
export function findLatestSuspendedAutoResume(snapshot: unknown): boolean | undefined {
  let latest: { at: number; value: boolean } | undefined;
  /** Records the values persisted at or under `entry`; whether it found one. */
  const visit = (entry: unknown): boolean => {
    if (!isRecord(entry) || entry.status !== 'suspended') return false;
    const suspendPayload = isRecord(entry.suspendPayload) ? entry.suspendPayload : undefined;
    const meta = isRecord(suspendPayload?.__workflow_meta) ? suspendPayload.__workflow_meta : undefined;
    const perCall = Array.isArray(meta?.foreachOutput)
      ? meta.foreachOutput
      : Array.isArray(entry.output)
        ? entry.output
        : undefined;
    let found = false;
    for (const call of perCall ?? []) found = visit(call) || found;
    // The step's own payload is read only when no per-call record carries the value.
    if (found) return true;
    const value = suspendPayload?.__autoResumeSuspendedTools;
    if (typeof value !== 'boolean') return false;
    const at = typeof entry.suspendedAt === 'number' ? entry.suspendedAt : 0;
    if (!latest || at >= latest.at) latest = { at, value };
    return true;
  };
  const context = isRecord(snapshot) && isRecord(snapshot.context) ? snapshot.context : undefined;
  for (const step of Object.values(context ?? {})) visit(step);
  return latest?.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
