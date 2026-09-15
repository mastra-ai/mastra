export function skillSnapshotFieldValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => skillSnapshotFieldValuesEqual(value, b[index]));
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(objectA), ...Object.keys(objectB)]))
    .filter(key => !(objectA[key] == null && objectB[key] == null))
    .sort();

  return keys.every(key => skillSnapshotFieldValuesEqual(objectA[key], objectB[key]));
}
