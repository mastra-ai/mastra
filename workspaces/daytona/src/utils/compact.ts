/**
 * Returns a shallow copy of the object with all undefined values removed.
 */
export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
