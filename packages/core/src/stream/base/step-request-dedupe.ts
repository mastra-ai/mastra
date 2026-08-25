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

/**
 * Whether a value's JSON text identifies it uniquely.
 *
 * Two steps are treated as sharing a request when their JSON text matches, so
 * the text has to be injective over the values we compare. It is not, for the
 * types JSON has no representation of: `Map`, `Set`, `Error` and class
 * instances all render as `{}`, and a key whose value is `undefined` or a
 * function disappears entirely — so two genuinely different requests would
 * collide and one step would resume against the other's request.
 *
 * `Date` is allowed: it renders lossily, but distinct instants still render
 * distinctly, so it cannot collide. Anything else falls back to storing the
 * request inline, which is what every snapshot did before this change.
 */
function hasInjectiveJson(value: unknown, seen = new Set<object>()): boolean {
  if (value === null) return true;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  // NaN and ±Infinity all render as `null`.
  if (type === 'number') return Number.isFinite(value);
  if (type !== 'object') return false;

  const object = value as object;
  // A cycle would throw in `JSON.stringify` anyway; refuse it up front rather
  // than paying for the throw.
  if (seen.has(object)) return false;
  seen.add(object);

  try {
    if (object instanceof Date) return true;

    if (Array.isArray(object)) {
      // A hole and an explicit `undefined` both render as `null`, as does any
      // element JSON drops.
      return object.every((element, index) => index in object && hasInjectiveJson(element, seen));
    }

    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) return false;

    // `toJSON` replaces the value with something we have not inspected.
    if ('toJSON' in object) return false;

    return Reflect.ownKeys(object).every(key => {
      // A symbol key is dropped silently; a symbol or function value makes the
      // whole entry disappear.
      if (typeof key === 'symbol') return false;
      return hasInjectiveJson((object as Record<string, unknown>)[key], seen);
    });
  } finally {
    seen.delete(object);
  }
}

export function dedupeStepRequests<T extends StepLike>(steps: T[]): { steps: T[]; requests: unknown[] | undefined } {
  // With fewer than two steps there is nothing to share, and the extra table
  // would only add noise to the snapshot.
  if (!Array.isArray(steps) || steps.length < 2) return { steps, requests: undefined };

  const requests: unknown[] = [];
  const indexByKey = new Map<string, number>();
  let sharedAny = false;

  const rewritten = steps.map(step => {
    if (!step || typeof step !== 'object' || step.request === undefined) return step;

    // The persistence codec preserves types JSON does not (Date, Error, Map,
    // Set), so a request can legitimately hold one and survive the round trip.
    // JSON text cannot tell two of those apart, so requests carrying one are
    // left inline rather than deduplicated against each other.
    if (!hasInjectiveJson(step.request)) return step;

    let key: string;
    try {
      key = JSON.stringify(step.request) ?? 'undefined';
    } catch {
      // Defensive: `hasInjectiveJson` already rejects the values that throw
      // (cycles, BigInt). Leave the request inline if one slips through.
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
