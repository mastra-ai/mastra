/**
 * Recursively transforms a type to represent its JSON-serialized form:
 * - Date → string (ISO string after JSON.stringify)
 * - Preserves all other types as-is
 */
export type JsonSerialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? JsonSerialized<U>[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: JsonSerialized<T[K]> }
      : T;
