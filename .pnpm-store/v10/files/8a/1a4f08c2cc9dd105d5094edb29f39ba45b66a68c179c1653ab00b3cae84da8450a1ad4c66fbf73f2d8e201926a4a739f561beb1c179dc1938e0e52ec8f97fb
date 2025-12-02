/**
 * Serialize a value to JSON
 * @param value A JavaScript value, usually an object or array, to be converted.
 * @param replacer A function that transforms the results.
 * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
 * @returns JSON string
 */
export declare const toJson: (value: unknown, replacer?: (this: unknown, key: string, value: unknown) => unknown, space?: string | number) => string;
/**
 * Parse JSON string to object, array, or other type
 * @param text A valid JSON string.
 * @param reviver A function that transforms the results. This function is called for each member of the object. If a member contains nested objects, the nested objects are transformed before the parent object is.
 * @returns Parsed object, array, or other type
 */
export declare function fromJson<T = unknown>(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): T;
