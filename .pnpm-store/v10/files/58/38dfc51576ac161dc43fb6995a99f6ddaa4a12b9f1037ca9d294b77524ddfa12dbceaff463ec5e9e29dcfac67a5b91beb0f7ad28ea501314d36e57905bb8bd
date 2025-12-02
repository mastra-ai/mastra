import type { Parser } from './parser.js';
/**
 * Helper to tokenize an object and its prototype
 */
export declare function tokenizeObject(value: Record<string | symbol, any>, parser: Parser, config: {
    depth: number;
    showHidden: boolean;
    collapse: string[];
    inspectObjectPrototype: boolean | 'unless-plain-object';
    constructorName?: string;
    membersToIgnore?: (string | symbol)[];
    eagerGetters?: (string | symbol)[];
}): void;
/**
 * Tokenizes the prototype of a value by calling Object.getPrototypeOf
 * method on the value.
 */
export declare function tokenizePrototype(value: any, parser: Parser, config: {
    prototypeToIgnore?: any;
    membersToIgnore?: (string | symbol)[];
    eagerGetters?: (string | symbol)[];
}): void;
/**
 * Helper to tokenize array like values.
 */
export declare function tokenizeArray(values: Array<any> | Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array, parser: Parser, config: {
    name?: string;
    depth: number;
    collapse: string[];
    inspectArrayPrototype: boolean;
    maxArrayLength: number;
}): void;
/**
 * HTML escape string values so that they can be nested
 * inside the pre-tags.
 */
export declare function htmlEscape(value: string): string;
/**
 * Wraps a string value to be on multiple lines after
 * a certain characters limit has been hit.
 */
export declare function wordWrap(value: string, options: {
    width: number;
    indent: string;
    newLine: string;
    escape?: (value: string) => string;
}): string;
