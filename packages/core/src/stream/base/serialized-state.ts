const SHARED_REQUEST_BODIES_KEY = '__mastraSharedRequestBodies';
const REQUEST_BODY_REF_KEY = '__mastraRequestBodyRef';

type SerializableRecord = Record<string, any>;

function isPlainObject(value: unknown): value is SerializableRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeBody(body: unknown): string | undefined {
  try {
    const serialized = JSON.stringify(body);
    return serialized === undefined ? undefined : `${typeof body}:${serialized}`;
  } catch {
    // A workflow snapshot must ultimately be JSON serializable, but keep the
    // pruning hook fail-open if a custom provider puts an unsupported value
    // in request metadata.
    return undefined;
  }
}

/**
 * Deduplicates byte-identical request bodies in a serialized model-output
 * state. Provider request bodies often repeat large, invariant tool schemas
 * and system instructions for every step in an agent loop.
 *
 * Only bodies that occur more than once are moved into the shared table.
 * Copy-on-write; the live model output and the snapshot passed to the pruning
 * hook are never mutated.
 */
export function compactStreamStateRequestBodies<T>(state: T): T {
  if (!isPlainObject(state) || !Array.isArray(state.bufferedSteps)) return state;
  if (SHARED_REQUEST_BODIES_KEY in state) return state;

  const occurrences = new Map<string, { body: unknown; count: number; ref?: number }>();
  const serializedByStep = new Map<number, string>();

  for (const [index, step] of state.bufferedSteps.entries()) {
    if (!isPlainObject(step) || !isPlainObject(step.request)) continue;
    if (REQUEST_BODY_REF_KEY in step.request || !Object.prototype.hasOwnProperty.call(step.request, 'body')) continue;

    const serialized = serializeBody(step.request.body);
    if (serialized === undefined) continue;

    serializedByStep.set(index, serialized);
    const occurrence = occurrences.get(serialized);
    if (occurrence) {
      occurrence.count++;
    } else {
      occurrences.set(serialized, { body: step.request.body, count: 1 });
    }
  }

  const sharedRequestBodies: unknown[] = [];
  for (const occurrence of occurrences.values()) {
    if (occurrence.count > 1) {
      occurrence.ref = sharedRequestBodies.length;
      sharedRequestBodies.push(occurrence.body);
    }
  }
  if (sharedRequestBodies.length === 0) return state;

  const bufferedSteps = state.bufferedSteps.map((step: unknown, index: number) => {
    if (!isPlainObject(step) || !isPlainObject(step.request)) return step;
    const serialized = serializedByStep.get(index);
    const ref = serialized === undefined ? undefined : occurrences.get(serialized)?.ref;
    if (ref === undefined) return step;

    const request: SerializableRecord = { ...step.request, [REQUEST_BODY_REF_KEY]: ref };
    delete request.body;
    return { ...step, request };
  });

  return {
    ...state,
    bufferedSteps,
    [SHARED_REQUEST_BODIES_KEY]: sharedRequestBodies,
  } as T;
}

/**
 * Restores request bodies compacted by `compactStreamStateRequestBodies`.
 * Older snapshots without the marker pass through unchanged.
 */
export function expandStreamStateRequestBodies<T>(state: T): T {
  if (!isPlainObject(state) || !Array.isArray(state.bufferedSteps)) return state;
  const sharedRequestBodies = state[SHARED_REQUEST_BODIES_KEY];
  if (!Array.isArray(sharedRequestBodies)) return state;

  const bufferedSteps = state.bufferedSteps.map((step: unknown) => {
    if (!isPlainObject(step) || !isPlainObject(step.request)) return step;
    const ref = step.request[REQUEST_BODY_REF_KEY];
    if (!Number.isInteger(ref) || ref < 0 || ref >= sharedRequestBodies.length) return step;

    const request: SerializableRecord = { ...step.request, body: sharedRequestBodies[ref] };
    delete request[REQUEST_BODY_REF_KEY];
    return { ...step, request };
  });

  const expanded: SerializableRecord = { ...state, bufferedSteps };
  delete expanded[SHARED_REQUEST_BODIES_KEY];
  return expanded as T;
}
