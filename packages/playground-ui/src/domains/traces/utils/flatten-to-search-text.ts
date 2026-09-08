/**
 * Flatten an arbitrary value into a single space-separated string containing
 * every searchable token it holds, however deeply nested.
 *
 * Built for span payloads whose shape is not known ahead of time (`attributes`,
 * `output`, `errorInfo`): the caller cannot enumerate fields, so this walks
 * whatever it is handed.
 *
 * **Keys are emitted alongside their values**, so a field name is searchable
 * even when its value is not — `{ error: null }` still answers a search for
 * `error`. The cost is that structural names present on every span (`traceId`,
 * `usage`, …) are searchable too, which makes short generic terms match widely.
 *
 * Values that no one can usefully search for are dropped rather than
 * stringified: `null`, `undefined`, `NaN`, infinities, functions, symbols,
 * invalid dates and whitespace-only strings. Dropping them keeps the output
 * free of noise words like `"Invalid Date"` that would produce false hits.
 * Array indices are dropped for the same reason — `0 1 2` is not content.
 *
 * Cycles are detected along the current path, so a self-referencing object
 * terminates while a value referenced twice as a sibling is emitted twice.
 * Only own, string-keyed properties are read, and a getter that throws is
 * skipped instead of taking the whole trace down.
 */
export function flattenToSearchText(value: unknown): string {
  const parts: string[] = [];
  const path = new Set<object>();

  collect(value, parts, path);

  return parts.join(' ');
}

function collect(value: unknown, parts: string[], path: Set<object>): void {
  if (value === null || value === undefined) return;

  switch (typeof value) {
    case 'string': {
      const trimmed = value.trim();
      if (trimmed) parts.push(trimmed);
      return;
    }
    case 'number': {
      // NaN and infinities have no useful search form.
      if (Number.isFinite(value)) parts.push(String(value));
      return;
    }
    case 'boolean':
    case 'bigint':
      parts.push(String(value));
      return;
    case 'function':
    case 'symbol':
      return;
  }

  const object = value as object;

  // Guard the current path only: a cycle must terminate, but the same object
  // referenced twice side by side is legitimately worth emitting twice.
  if (path.has(object)) return;
  path.add(object);

  try {
    collectFromObject(object, parts, path);
  } finally {
    path.delete(object);
  }
}

function collectFromObject(object: object, parts: string[], path: Set<object>): void {
  if (object instanceof Date) {
    const time = object.getTime();
    if (!Number.isNaN(time)) parts.push(object.toISOString());
    return;
  }

  if (object instanceof Error) {
    collect(object.message, parts, path);
    return;
  }

  // Indices carry no meaning, so an array contributes only its items.
  if (Array.isArray(object)) {
    for (const item of object) collect(item, parts, path);
    return;
  }

  if (object instanceof Map) {
    for (const [key, item] of object) {
      collect(key, parts, path);
      collect(item, parts, path);
    }
    return;
  }

  // A Set has members, not fields.
  if (object instanceof Set) {
    for (const item of object) collect(item, parts, path);
    return;
  }

  // Own string keys only: skips the prototype chain and symbol-keyed entries.
  for (const key of Object.keys(object)) {
    // The key is emitted even when the value turns out to be unsearchable, so
    // the presence of a field is itself findable.
    collect(key, parts, path);

    let item: unknown;
    try {
      item = (object as Record<string, unknown>)[key];
    } catch {
      // A getter that throws is not a reason to lose the rest of the payload.
      continue;
    }
    collect(item, parts, path);
  }
}
