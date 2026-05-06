/**
 * Checks if a method exists on an object and is callable.
 */
export function hasMethod<T>(obj: T, method: string): boolean {
  return method in (obj as object) && typeof (obj as Record<string, unknown>)[method] === 'function';
}
