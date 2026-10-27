function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((value, i) => jsonEqual(value, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]))
    );
  }
  return false;
}

function setKey(target: Record<string, unknown>, key: string, value: unknown): void {
  // defineProperty, so a `__proto__` key is stored as data rather than replacing the prototype.
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/** `state` as JSON, or `undefined` when it can't be (a cycle, a BigInt). */
export function toJsonState(state: unknown): Record<string, unknown> | undefined {
  try {
    return JSON.parse(JSON.stringify(state ?? {}));
  } catch {
    return undefined;
  }
}

/**
 * A copy of `value`'s plain objects and arrays, so changes to the copy don't reach `value`. Other
 * values (Dates, Maps, class instances, functions) are kept as they are, not copied.
 */
export function copyState<T>(value: T, copies = new Map<unknown, unknown>()): T {
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (copies.has(value)) return copies.get(value) as T;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    copies.set(value, copy);
    for (const item of value) copy.push(copyState(item, copies));
    return copy as T;
  }
  const copy: Record<string, unknown> = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
  copies.set(value, copy);
  for (const key of Object.keys(value)) setKey(copy, key, copyState(value[key], copies));
  return copy as T;
}

/**
 * The state a nested run hands back to its parent's step: the nested run's changes since `base`,
 * applied to the parent's current state `target`, so changes the parent's other steps made
 * meanwhile are kept.
 *
 * `base` is the JSON state the nested run's changes are relative to: the state it started from,
 * or the state it resumed from (which its parent already holds). `final` is its state now.
 *
 * Returns every key of `final`. A key the nested run didn't change keeps the parent's value (or
 * takes the nested run's, such as a schema default, when the parent doesn't have it). A list the
 * nested run only appended to gets those items appended to the parent's list, after any the
 * parent's other steps appended. An object is merged key by key. Any other changed value is the
 * nested run's. A top-level key the nested run removed is left alone, as `setState` does.
 */
export function rebaseNestedState<TState>(target: TState, base: Record<string, unknown>, final: TState): TState {
  const finalJson = toJsonState(final);
  if (!finalJson) return final;
  const parent = target as Record<string, unknown>;
  const nested = final as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(nested)) {
    setKey(result, key, rebaseValue(parent, key, base[key], nested[key], finalJson[key]));
  }
  return result as TState;
}

/** The rebased value of `key` of the parent object `target`. */
function rebaseValue(
  targetObject: Record<string, unknown>,
  key: string,
  base: unknown,
  final: unknown,
  finalJson: unknown,
): unknown {
  if (!Object.hasOwn(targetObject, key)) return final;
  const target = targetObject[key];
  if (jsonEqual(base, finalJson)) return target;
  if (
    Array.isArray(target) &&
    Array.isArray(base) &&
    Array.isArray(final) &&
    Array.isArray(finalJson) &&
    base.length <= finalJson.length &&
    base.every((value, i) => jsonEqual(value, finalJson[i]))
  ) {
    return [...target, ...final.slice(base.length)];
  }
  if (isPlainObject(target) && isPlainObject(base) && isPlainObject(final) && isPlainObject(finalJson)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(target)) {
      if (!Object.hasOwn(base, key) || Object.hasOwn(final, key)) setKey(result, key, target[key]);
    }
    for (const key of Object.keys(final)) {
      setKey(result, key, rebaseValue(target, key, base[key], final[key], finalJson[key]));
    }
    return result;
  }
  return final;
}
