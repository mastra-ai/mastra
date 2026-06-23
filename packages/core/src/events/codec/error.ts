import type { SerializedError } from '../../error/utils';

const MAX_CAUSE_DEPTH = 5;

/**
 * Serializes an Error instance to a plain SerializedError object without
 * mutating the original. Unlike `getErrorFromUnknown(...).toJSON()`, this does
 * not attach a non-enumerable `toJSON` to the live Error.
 */
export function serializeError(err: Error, depth = 0): SerializedError {
  const json: SerializedError = {
    name: err.name || 'Error',
    message: err.message,
  };
  if (err.stack !== undefined) json.stack = err.stack;

  if (err.cause !== undefined) {
    if (err.cause instanceof Error && depth < MAX_CAUSE_DEPTH) {
      json.cause = serializeError(err.cause, depth + 1);
    } else {
      json.cause = err.cause;
    }
  }

  // Copy enumerable own properties (custom error fields)
  for (const key in err) {
    if (!Object.prototype.hasOwnProperty.call(err, key)) continue;
    if (key === 'message' || key === 'name' || key === 'stack' || key === 'cause') continue;
    json[key] = (err as unknown as Record<string, unknown>)[key];
  }

  return json;
}

/**
 * Rehydrates a SerializedError into a vanilla Error instance. We never
 * instantiate user-controlled prototypes — name is preserved as a string field.
 */
export function rehydrateError(s: SerializedError): Error {
  const cause =
    s.cause !== undefined
      ? s.cause && typeof s.cause === 'object' && 'message' in (s.cause as object) && 'name' in (s.cause as object)
        ? rehydrateError(s.cause as SerializedError)
        : s.cause
      : undefined;

  const err = cause !== undefined ? new Error(s.message, { cause }) : new Error(s.message);
  if (s.name) err.name = s.name;
  if (s.stack !== undefined) err.stack = s.stack;

  for (const key in s) {
    if (!Object.prototype.hasOwnProperty.call(s, key)) continue;
    if (key === 'message' || key === 'name' || key === 'stack' || key === 'cause') continue;
    (err as unknown as Record<string, unknown>)[key] = s[key];
  }

  return err;
}
