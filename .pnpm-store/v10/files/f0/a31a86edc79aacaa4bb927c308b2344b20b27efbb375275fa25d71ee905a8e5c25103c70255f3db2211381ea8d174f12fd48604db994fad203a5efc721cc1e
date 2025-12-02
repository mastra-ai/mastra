/**
 * Convert words to a sentence.
 *
 * @param items - An array of words to be joined.
 * @returns A string with the items joined by a comma and the last item joined by ", or".
 */
declare const toSentence: (items: string[]) => string;
/**
 * Checks if a string is a valid IPv4 address.
 *
 * @returns True if the string is a valid IPv4 address, false otherwise.
 */
declare function isIPV4Address(str: string | undefined | null): boolean;
/**
 * Converts the first character of a string to uppercase.
 *
 * @param str - The string to be converted.
 * @returns The modified string with the rest of the string unchanged.
 *
 * @example
 * ```ts
 * titleize('hello world') // 'Hello world'
 * ```
 */
declare function titleize(str: string | undefined | null): string;
/**
 * Converts a string from snake_case to camelCase.
 */
declare function snakeToCamel(str: string | undefined): string;
/**
 * Converts a string from camelCase to snake_case.
 */
declare function camelToSnake(str: string | undefined): string;
/**
 * Transforms camelCased objects/ arrays to snake_cased.
 * This function recursively traverses all objects and arrays of the passed value
 * camelCased keys are removed.
 *
 * @function
 */
declare const deepCamelToSnake: (obj: any) => any;
/**
 * Transforms snake_cased objects/ arrays to camelCased.
 * This function recursively traverses all objects and arrays of the passed value
 * camelCased keys are removed.
 *
 * @function
 */
declare const deepSnakeToCamel: (obj: any) => any;
/**
 * A function to determine if a value is truthy.
 *
 * @returns True for `true`, true, positive numbers. False for `false`, false, 0, negative integers and anything else.
 */
declare function isTruthy(value: unknown): boolean;
/**
 * Get all non-undefined values from an object.
 */
declare function getNonUndefinedValues<T extends object>(obj: T): Partial<T>;

export { camelToSnake, deepCamelToSnake, deepSnakeToCamel, getNonUndefinedValues, isIPV4Address, isTruthy, snakeToCamel, titleize, toSentence };
