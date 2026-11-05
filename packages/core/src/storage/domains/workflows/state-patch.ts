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

const OMITTED = Symbol('omitted');

/**
 * `value`, the `key` property of its holder, one level deep as `JSON.stringify` serializes it:
 * `toJSON` applied, boxed primitives unboxed, non-finite numbers as `null`, and `OMITTED` for
 * what it leaves out. Objects and arrays are returned as they are.
 */
function jsonNode(value: unknown, key: string): unknown {
  if ((typeof value === 'object' && value !== null) || typeof value === 'function' || typeof value === 'bigint') {
    const toJSON = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function') value = toJSON.call(value, key);
  }
  if (value instanceof Number) value = Number(value);
  else if (value instanceof String) value = String(value);
  else if (value instanceof Boolean) value = value.valueOf();
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'object':
      return value;
    case 'number':
      // -0 is written as 0.
      return Number.isFinite(value) ? value + 0 : null;
    case 'bigint':
      throw new TypeError('Do not know how to serialize a BigInt');
    default:
      return OMITTED;
  }
}

function arrayItem(array: unknown[], i: number): unknown {
  const item = jsonNode(array[i], String(i));
  return item === OMITTED ? null : item;
}

/** A JSON copy of a `jsonNode` result. Throws, as `JSON.stringify` does, on a cycle. */
function jsonCopy(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  // `jsonNode` has already applied this node's `toJSON`; `JSON.stringify` would apply it again.
  if (typeof (node as { toJSON?: unknown }).toJSON === 'function') {
    if (Array.isArray(node)) node = node.slice();
    else {
      const { toJSON: _, ...rest } = node as Record<string, unknown>;
      node = rest;
    }
  }
  return JSON.parse(JSON.stringify(node));
}

/**
 * `diffState(prev, JSON.parse(JSON.stringify(next)))` without copying `next`: `next` can be any
 * JSON-serializable value and is compared as its JSON form, and only the values of `set` ops are
 * copied. `prev` must be a JSON value. Throws a `TypeError`, as `JSON.stringify` does, when
 * `next` has a cycle or a BigInt, or has no JSON form at all.
 * @experimental
 */
export function diffStateAsJson(prev: unknown, next: unknown): StatePatchOp[] {
  const root = jsonNode(next, '');
  if (root === OMITTED) throw new TypeError(`A ${typeof next} has no JSON form`);
  const ops: StatePatchOp[] = [];
  diffJsonValue(prev, root, [], ops);
  return ops;
}

/**
 * `diffValue` on `next`'s JSON form, which `jsonNode` gives one level at a time. Every part of
 * `next` is either walked alongside `prev` or copied by `jsonCopy`, and `prev` is finite, so a
 * cycle in `next` always reaches `jsonCopy`, which throws.
 */
function diffJsonValue(prev: unknown, next: unknown, path: (string | number)[], ops: StatePatchOp[]): void {
  if (typeof next !== 'object' || next === null) {
    if (prev !== next) ops.push({ op: 'set', path, value: next });
    return;
  }
  if (Array.isArray(next)) {
    if (!Array.isArray(prev) || next.length < prev.length) {
      ops.push({ op: 'set', path, value: jsonCopy(next) });
      return;
    }
    for (let i = 0; i < prev.length; i++) diffJsonValue(prev[i], arrayItem(next, i), [...path, i], ops);
    for (let i = prev.length; i < next.length; i++) {
      ops.push({ op: 'set', path: [...path, i], value: jsonCopy(arrayItem(next, i)) });
    }
    return;
  }
  if (!isObject(prev)) {
    ops.push({ op: 'set', path, value: jsonCopy(next) });
    return;
  }
  const kept = new Map<string, unknown>();
  for (const key of Object.keys(next)) {
    const value = jsonNode((next as Record<string, unknown>)[key], key);
    if (value !== OMITTED) kept.set(key, value);
  }
  for (const key of Object.keys(prev)) {
    if (!kept.has(key)) ops.push({ op: 'delete', path: [...path, key] });
  }
  for (const [key, value] of kept) {
    if (Object.hasOwn(prev, key)) diffJsonValue(prev[key], value, [...path, key], ops);
    else ops.push({ op: 'set', path: [...path, key], value: jsonCopy(value) });
  }
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
  return applyOps(root, ops);
}

/**
 * `applyStatePatch` that leaves `root` as it is: each object or array an op changes is copied
 * (once) first, so the result shares only what the ops didn't change with `root`.
 * @experimental
 */
export function patchState<T = Record<string, any>>(root: T, ops: readonly StatePatchOp[]): T {
  return applyOps(root, ops, new Set());
}

/** With `copies`, the containers copied or created so far, which ops can change in place. */
function applyOps(root: any, ops: readonly StatePatchOp[], copies?: Set<object>): any {
  const own = (value: any) => {
    if (!copies || typeof value !== 'object' || value === null || copies.has(value)) return value;
    // Spread defines a `__proto__` key as data, like `setChild`.
    const copy = Array.isArray(value) ? value.slice() : { ...value };
    copies.add(copy);
    return copy;
  };
  const copyOf = (value: unknown) => {
    const copy = structuredClone(value);
    if (typeof copy === 'object' && copy !== null) copies?.add(copy);
    return copy;
  };
  let result = root;
  for (const op of ops) {
    if (op.path.length === 0) {
      if (op.op === 'set') result = copyOf(op.value);
      continue;
    }
    result = own(result);
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
        copies?.add(child as object);
        setChild(container, key, child);
      } else if (copies && !copies.has(child)) {
        child = own(child);
        setChild(container, key, child);
      }
      container = child;
    }
    if (container === undefined) continue;
    const key = op.path[op.path.length - 1]!;
    if (op.op === 'set') setChild(container, key, copyOf(op.value));
    else if (Object.hasOwn(container, key)) delete container[key];
  }
  return result;
}
