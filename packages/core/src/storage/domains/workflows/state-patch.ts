/**
 * One change to a storage v2 run's state. `path` addresses a value from the state's root: a
 * number is an array index and a string is an object key. An empty path is the root.
 *
 * Ops are absolute (there is no relative append), so replaying a list of ops onto a state that
 * already contains them changes nothing.
 * @experimental
 */
export type StatePatchOp =
  | { op: 'set'; path: (string | number)[]; value: unknown }
  | { op: 'delete'; path: (string | number)[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The ops that turn `prev` into `next`. Both must be JSON values (no `undefined`, Dates or class
 * instances). Unchanged values produce no ops.
 * @experimental
 */
export function diffState(prev: unknown, next: unknown): StatePatchOp[] {
  const ops: StatePatchOp[] = [];
  diffValue(prev, next, [], ops);
  return ops;
}

function diffValue(prev: unknown, next: unknown, path: (string | number)[], ops: StatePatchOp[]): void {
  if (prev === next) return;
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (next.length < prev.length) {
      ops.push({ op: 'set', path, value: next });
      return;
    }
    for (let i = 0; i < prev.length; i++) diffValue(prev[i], next[i], [...path, i], ops);
    for (let i = prev.length; i < next.length; i++) ops.push({ op: 'set', path: [...path, i], value: next[i] });
    return;
  }
  if (isObject(prev) && isObject(next)) {
    for (const key of Object.keys(prev)) {
      if (!Object.hasOwn(next, key)) ops.push({ op: 'delete', path: [...path, key] });
    }
    for (const key of Object.keys(next)) {
      if (Object.hasOwn(prev, key)) diffValue(prev[key], next[key], [...path, key], ops);
      else ops.push({ op: 'set', path: [...path, key], value: next[key] });
    }
    return;
  }
  ops.push({ op: 'set', path, value: next });
}

function childOf(container: any, key: string | number): unknown {
  return Object.hasOwn(container, key) ? container[key] : undefined;
}

function setChild(container: any, key: string | number, value: unknown): void {
  // defineProperty, so a `__proto__` key is stored as data rather than replacing the prototype.
  Object.defineProperty(container, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Apply `ops` to `root` in order and return the result: `root` itself, mutated, unless an op
 * replaces the root. A `set` creates missing or non-container intermediates (`[]` before a number
 * segment, `{}` before a string); a `delete` whose path doesn't exist does nothing. Set values are
 * copied, so the result shares nothing with `ops`.
 * @experimental
 */
export function applyStatePatch<T = Record<string, any>>(root: T, ops: readonly StatePatchOp[]): T {
  let result: any = root;
  for (const op of ops) {
    if (op.path.length === 0) {
      if (op.op === 'set') result = structuredClone(op.value);
      continue;
    }
    let container = result;
    for (let i = 0; i < op.path.length - 1; i++) {
      const key = op.path[i]!;
      let child = childOf(container, key);
      if (typeof child !== 'object' || child === null) {
        if (op.op === 'delete') {
          container = undefined;
          break;
        }
        child = typeof op.path[i + 1] === 'number' ? [] : {};
        setChild(container, key, child);
      }
      container = child;
    }
    if (container === undefined) continue;
    const key = op.path[op.path.length - 1]!;
    if (op.op === 'set') setChild(container, key, structuredClone(op.value));
    else if (Object.hasOwn(container, key)) delete container[key];
  }
  return result;
}
