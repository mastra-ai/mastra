const ABSENT = Symbol('absent');

/** A value as `JSON.stringify` sees it once `toJSON` has run: unboxed, and ABSENT where JSON drops it. */
function plainJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return typeof value === 'bigint' ? value : ABSENT;
  if (value instanceof Number || value instanceof String || value instanceof Boolean) return value.valueOf();
  return value;
}

/** A value as `JSON.stringify` sees it under `key`. Like JSON, `toJSON` runs once, not again on its result. */
function jsonValue(value: unknown, key: string): unknown {
  if (value !== null && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return plainJsonValue((value as { toJSON: (key: string) => unknown }).toJSON(key));
  }
  return plainJsonValue(value);
}

const hasOwn = Object.prototype.hasOwnProperty;

type Pending = { stack: [object, object][]; seen: WeakMap<object, WeakSet<object>> };

/**
 * Compares two JSON values, pushing nested object pairs onto `pending` instead of recursing, so deeply nested content
 * cannot overflow the call stack. Returns false as soon as a difference is found, and for a pair reached a second
 * time: JSON.stringify threw on cycles, so a cyclic part was never matched, and stored parts (read back from JSON)
 * never share objects.
 */
function compareInto(a: unknown, b: unknown, pending: Pending): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  let partners = pending.seen.get(a);
  if (!partners) pending.seen.set(a, (partners = new WeakSet()));
  if (partners.has(b)) return false;
  partners.add(b);
  pending.stack.push([a, b]);
  return true;
}

function compareObjects(a: object, b: object, pending: Pending, skip?: string): boolean {
  if (Array.isArray(a)) {
    const other = b as unknown[];
    if (a.length !== other.length) return false;
    for (let i = 0; i < a.length; i++) {
      const left = jsonValue(a[i], String(i));
      const right = jsonValue(other[i], String(i));
      if (!compareInto(left === ABSENT ? null : left, right === ABSENT ? null : right, pending)) return false;
    }
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  let present = 0;
  for (const key in left) {
    if (!hasOwn.call(left, key) || key === skip) continue;
    const value = jsonValue(left[key], key);
    if (value === ABSENT) continue;
    present++;
    const other = hasOwn.call(right, key) ? jsonValue(right[key], key) : ABSENT;
    if (other === ABSENT || !compareInto(value, other, pending)) return false;
  }
  for (const key in right) {
    if (!hasOwn.call(right, key) || key === skip) continue;
    if (jsonValue(right[key], key) !== ABSENT) present--;
  }
  return present === 0;
}

function drain(pending: Pending): boolean {
  while (pending.stack.length > 0) {
    const [left, right] = pending.stack.pop()!;
    if (!compareObjects(left, right, pending)) return false;
  }
  return true;
}

/**
 * Whether two message parts have the same content apart from their top-level `providerMetadata`: equal as JSON, the
 * way storage keeps them, but compared in place and regardless of object key order. Used to check that a stored part
 * is the part OM counted before writing its count back.
 */
export function samePartContent(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const pending: Pending = { stack: [], seen: new WeakMap() };
  return compareObjects(a, b, pending, 'providerMetadata') && drain(pending);
}

/** The part's `providerMetadata` as the write-back compares it: every key kept, but `mastra.tokenEstimate` dropped. */
function metadataWithoutEstimate(part: Record<string, unknown>): Record<string, unknown> {
  const metadata = (part.providerMetadata ?? {}) as Record<string, unknown>;
  const { tokenEstimate: _tokenEstimate, ...mastra } = (metadata.mastra ?? {}) as Record<string, unknown>;
  return { ...metadata, mastra };
}

/**
 * Whether two parts are equal as JSON apart from `providerMetadata.mastra.tokenEstimate`, compared in place and
 * regardless of object key order. `providerMetadata.mastra.modelOutput` and every other metadata key still count, so
 * two parts with the same raw content but a different model output do not share a count.
 */
export function samePartExceptTokenEstimate(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (!samePartContent(a, b)) return false;
  const pending: Pending = { stack: [], seen: new WeakMap() };
  return compareObjects(metadataWithoutEstimate(a), metadataWithoutEstimate(b), pending) && drain(pending);
}
