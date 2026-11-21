/**
 * Type-preserving deep copy for the messages handed to user hooks. Unlike `structuredClone`, a
 * Buffer stays a Buffer, so hooks that test `Buffer.isBuffer` keep working. Shapes it can't copy
 * safely (class instances, Map/Set, functions, streams, Blob, proxies) are passed by reference,
 * unchanged. Cycles and shared references inside one input keep their shape.
 */
export function detachMessagePayload<T>(value: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (value === null || typeof value !== 'object') return value;
  const object = value as unknown as object;
  const existing = seen.get(object);
  if (existing !== undefined) return existing as T;

  if (Buffer.isBuffer(object)) {
    const copy = Buffer.from(object);
    seen.set(object, copy);
    return copy as unknown as T;
  }
  if (object instanceof ArrayBuffer) {
    const copy = object.slice(0);
    seen.set(object, copy);
    return copy as unknown as T;
  }
  if (ArrayBuffer.isView(object)) {
    const copy =
      object instanceof DataView
        ? new DataView(object.buffer.slice(object.byteOffset, object.byteOffset + object.byteLength))
        : (object as unknown as { slice(): object }).slice();
    seen.set(object, copy);
    return copy as unknown as T;
  }
  if (object instanceof Date) {
    const copy = new Date(object.getTime());
    seen.set(object, copy);
    return copy as unknown as T;
  }
  if (object instanceof URL) {
    const copy = new URL(object.href);
    seen.set(object, copy);
    return copy as unknown as T;
  }

  if (Array.isArray(object)) {
    const copy: unknown[] = [];
    seen.set(object, copy);
    for (const item of object) copy.push(detachMessagePayload(item, seen));
    return copy as unknown as T;
  }

  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const copy: Record<string, unknown> = Object.create(prototype);
  seen.set(object, copy);
  for (const key of Object.keys(object)) {
    copy[key] = detachMessagePayload((object as Record<string, unknown>)[key], seen);
  }
  return copy as unknown as T;
}
