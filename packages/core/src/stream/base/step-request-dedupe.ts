/**
 * Every buffered step of a run carries the request that produced it, and that
 * request's `body` holds the tool schemas plus the system instruction — data
 * that is invariant across the steps of a single run and, in practice,
 * byte-identical. Persisting a full copy per step made a suspended snapshot
 * grow linearly with step count, and a HITL agent that takes a dozen tool calls
 * before its first approval could push a single document past MongoDB's hard
 * 16 MB limit, failing the write and stranding the run.
 *
 * So the snapshot stores each distinct request once and has the steps point at
 * it. This is purely a storage representation: callers still see a `request` on
 * every step after rehydration.
 */

const REQUEST_REF = '__requestRef' as const;

type StepLike = { request?: unknown };

export function dedupeStepRequests<T extends StepLike>(steps: T[]): { steps: T[]; requests: unknown[] | undefined } {
  // With fewer than two steps there is nothing to share, and the extra table
  // would only add noise to the snapshot.
  if (!Array.isArray(steps) || steps.length < 2) return { steps, requests: undefined };

  const requests: unknown[] = [];
  const indexByKey = new Map<string, number>();
  let sharedAny = false;

  const rewritten = steps.map(step => {
    if (!step || typeof step !== 'object' || step.request === undefined) return step;

    let key: string;
    try {
      key = JSON.stringify(step.request) ?? 'undefined';
    } catch {
      // A request that will not serialize (cycles, BigInt) cannot be compared
      // by value; leave it inline and let the existing behavior stand.
      return step;
    }

    let index = indexByKey.get(key);
    if (index === undefined) {
      index = requests.length;
      indexByKey.set(key, index);
      requests.push(step.request);
    } else {
      sharedAny = true;
    }

    const { request: _dropped, ...rest } = step as StepLike & Record<string, unknown>;
    return { ...rest, [REQUEST_REF]: index } as unknown as T;
  });

  // If no two steps shared a request, the table is the same size as the inline
  // copies were — keep the simpler shape.
  if (!sharedAny) return { steps, requests: undefined };

  return { steps: rewritten, requests };
}

export function rehydrateStepRequests<T extends StepLike>(steps: T[], requests: unknown[] | undefined): T[] {
  // Snapshots written before this change (and runs with nothing to share) store
  // the request inline on every step and need no rehydration.
  if (!Array.isArray(steps) || !Array.isArray(requests)) return steps;

  return steps.map(step => {
    if (!step || typeof step !== 'object' || !(REQUEST_REF in step)) return step;
    const { [REQUEST_REF]: index, ...rest } = step as Record<string, unknown>;
    return { ...rest, request: requests[index as number] } as unknown as T;
  });
}
