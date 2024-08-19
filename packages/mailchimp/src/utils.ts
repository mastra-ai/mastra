/**
 * Get a value from an object by a given path. This function emulates the behavior of lodash's _.get method.
 *
 * @param {Record<string, any>} object - The object from which to get the value.
 * @param {string | string[]} path - The path to the value in the object. This can be a string (e.g., 'a.b.c') or an array of keys (e.g., ['a', 'b', 'c']).
 * @returns {unknown} The value at the given path in the object, or undefined if the path does not exist.
 */
export const getPath = (object: Record<string, any>, path: string | string[]): unknown => {
  if (typeof path === 'string') {
    path = path.split('.');
  }

  return path.reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), object);
};
