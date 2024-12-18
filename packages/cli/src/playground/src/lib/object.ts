/**
 * Checks if object is empty
 * @param objectName
 * @returns boolean
 */
export const isObjectEmpty = (objectName: Object) => {
  return objectName && Object.keys(objectName).length === 0 && objectName.constructor === Object;
};

/**
 * Get a value from an object by a given path. This function emulates the behavior of lodash's _.get method.
 *
 * @param {Record<string, any>} object - The object from which to get the value.
 * @param {string | string[]} path - The path to the value in the object. This can be a string (e.g., 'a.b.c') or an array of keys (e.g., ['a', 'b', 'c']).
 * @returns {unknown} The value at the given path in the object, or undefined if the path does not exist.
 */
export const getPath = (object: Record<string, any>, path: string | string[]): unknown => {
  if (typeof path === 'string') {
    path = path?.split('.');
  }

  return path?.reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), object);
};

export function recordHasData(record: Record<any, any>): boolean {
  return Object.keys(record).length > 0;
}

export function isLiteralObject(a: unknown) {
  return !!a && a.constructor === Object;
}

export const constructObjFromStringPath = (path: string, value: any) => {
  if (!path) return {};
  //key, split the key with ., and then for each item, we update object data.pipeline
  // {data: {pipeline: 'kbdkjd'}}
  const pathArr = path.split('.');
  let newObject: Record<string, any> = {
    [pathArr[pathArr.length - 1]]: value,
  };
  let index = pathArr.length - 2;
  while (index >= 0) {
    newObject = { [pathArr[index]]: newObject };
    index = index - 1;
  }

  return newObject;
};

/**
 * Flatten a nested object, flatten from flat package works - https://www.npmjs.com/package/flat
 * but this allows you to define where you want it to stop by passing the keys that'll exist in the object you want it to stop at
 *
 * @param {Record<string, any>} object - The object to flatten.
 * @param {string[]} endKeys - The keys you want each value (which will be an object in this case) in the flattened object to possible have (e.g., ['a', 'b', 'c']).
 * @param {boolean} flattenArrayValue - This flag indicates that any array value should be flattened to object too.
 * @returns {Record<string, any>} Your flattened object
 */
export const flattenObject = (object: Record<string, any>, endKeys: string[] = [], flattenArrayValue?: boolean) => {
  let newObj = {} as Record<string, unknown>;

  function recurseDip(obj: Record<string, any>, path: string[]) {
    for (const [key, value] of Object.entries(obj)) {
      let newPath = [...path, key];
      if (value && value.constructor === Object) {
        const hasOnlyEndKeys = endKeys?.length ? endKeys.every(v => Object.keys(value).includes(v)) : false;
        if (hasOnlyEndKeys) {
          newObj = { ...newObj, [newPath.join('.')]: value };
        } else {
          recurseDip(value, newPath);
        }
      } else if (flattenArrayValue && Array.isArray(value)) {
        const contructValue = value.reduce((a, b) => ({ ...a, [value.indexOf(b)]: b }), {});
        recurseDip(contructValue, newPath);
      } else {
        newObj = { ...newObj, [newPath.join('.')]: value };
      }
    }
  }

  recurseDip(object, []);
  return newObj;
};

type AnyObject = { [key: string]: any };

/**
 * Merges two objects, ensuring that only defined properties from the second object
 * override those in the first object.
 *
 * @template T - The type of the base object.
 * @template U - The type of the overrides object.
 * @param {T} base - The base object whose properties will be overridden.
 * @param {U} overrides - The object containing properties to override in the base object.
 *                        Only properties that are defined (not `undefined`) will override.
 * @returns {T & U} - A new object that combines properties from both `base` and `overrides`.
 *                    Properties in `base` will be overridden by defined properties in `overrides`.
 *
 * @example
 * const worksheetData = { a: 1, b: 2, c: 3 };
 * const payload = { b: undefined, c: 4 };
 * const extendedData = mergeWithDefinedOnly(worksheetData, payload);
 * // extendedData = { a: 1, b: 2, c: 4 }
 */
export function mergeWithDefinedOnly<T extends AnyObject, U extends AnyObject>(base: T, overrides: U): T & U {
  const result: AnyObject = { ...base };

  for (const key in overrides) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key];
    }
  }

  return result as T & U;
}
