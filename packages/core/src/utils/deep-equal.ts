/**
 * Deep equality comparison for comparing two values.
 * Handles primitives, arrays, objects, and Date instances.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Handle identical references and primitives
  if (a === b) return true;

  // Handle null/undefined
  if (a == null || b == null) return a === b;

  // Handle different types
  if (typeof a !== typeof b) return false;

  // An array is only ever equal to another array, and a Date only to another
  // Date. Without these guards the generic object branch below compares
  // `Object.keys`, so a Date (no own enumerable keys) would equal `{}` and
  // `[1, 2]` would equal `{ '0': 1, '1': 2 }`.
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date !== b instanceof Date) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle dates (must check before generic objects since Date is also an object)
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle objects (after Date check to avoid treating Dates as plain objects)
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    // Verify that bObj has the same keys as aObj before comparing values
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]));
  }

  return false;
}
