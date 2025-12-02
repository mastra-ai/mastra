import type { TypeName } from '@sindresorhus/is';
import type { Parser } from './parser.js';
/**
 * Simplifies the complex merged types
 */
export type Simplify<T> = {
    [KeyType in keyof T]: T[KeyType];
} & {};
/**
 * Representation of a tokenizer function. Tokenizers are
 * responsible for converting values to a list of tokens
 * and collect them using the "parser.collect" method.
 */
export type Tokenizer = (value: any, parser: Parser) => void;
/**
 * Tokens Map represents the list of supported tokens. Tokens
 * without any properties acts as a boundary for enclosed
 * values.
 */
export type TokensMap = {
    /**
     * Object tokens
     */
    'object-start': {
        constructorName: null | string;
    };
    'object-end': {};
    'object-key': {
        isWritable: boolean;
        isSymbol: boolean;
        value: string;
    };
    'object-value-start': {};
    'object-value-end': {};
    'object-value-getter': {};
    'object-circular-ref': {};
    'object-max-depth-ref': {};
    /**
     * Array tokens
     */
    'array-start': {
        name: string;
        size: number;
    };
    'array-end': {
        size: number;
    };
    'array-value-start': {
        index: number;
    };
    'array-value-hole': {
        index: number;
    };
    'array-value-end': {
        index: number;
    };
    'array-circular-ref': {};
    'array-max-depth-ref': {};
    'array-max-length-ref': {
        limit: number;
        size: number;
    };
    /**
     * Boundary for the prototype properties
     */
    'prototype-start': {};
    'prototype-end': {};
    /**
     * Set tokens
     */
    'set-start': {
        size: number;
    };
    'set-end': {
        size: number;
    };
    'set-value-start': {
        index: number;
    };
    'set-value-end': {
        index: number;
    };
    'set-circular-ref': {};
    'set-max-depth-ref': {};
    'set-max-length-ref': {
        limit: number;
        size: number;
    };
    /**
     * Map tokens
     */
    'map-start': {
        size: number;
    };
    'map-end': {
        size: number;
    };
    'map-row-start': {
        index: number;
    };
    'map-row-end': {
        index: number;
    };
    'map-key-start': {
        index: number;
    };
    'map-key-end': {
        index: number;
    };
    'map-value-start': {
        index: number;
    };
    'map-value-end': {
        index: number;
    };
    'map-max-depth-ref': {};
    'map-circular-ref': {};
    'map-max-length-ref': {
        limit: number;
        size: number;
    };
    /**
     * Primitives
     */
    'string': {
        value: string;
    };
    'number': {
        value: number;
    };
    'bigInt': {
        value: string;
    };
    'boolean': {
        value: boolean;
    };
    'undefined': {};
    'null': {};
    'symbol': {
        value: string;
    };
    /**
     * Others
     */
    'function': {
        name: string;
        isGenerator: boolean;
        isAsync: boolean;
        isClass: boolean;
    };
    /**
     * Boundary for the static members
     */
    'static-members-start': {};
    'static-members-end': {};
    'date': {
        value: string;
    };
    'buffer': {
        value: string;
    };
    'regexp': {
        value: string;
    };
    'unknown': {
        jsType: TypeName;
        value: any;
    };
    'weak-set': {};
    'weak-ref': {};
    'weak-map': {};
    'observable': {};
    'blob': {
        size: number;
        contentType: string;
    };
    'promise': {
        isFulfilled: boolean;
    };
    'generator': {
        isAsync: boolean;
    };
    /**
     * Collapse token represents a value that has been
     * collpased and its children are not further
     * processed.
     *
     * Only objects and arrays can be collapsed
     */
    'collapse': {
        name: string;
        token: ({
            type: 'object-start';
        } & TokensMap['object-start']) | ({
            type: 'array-start';
        } & TokensMap['array-start']);
    };
};
/**
 * A union of known tokens. The tokenizer will always
 * output only these tokens
 */
export type Token = {
    [K in keyof TokensMap]: Simplify<{
        type: K;
    } & TokensMap[K]>;
}[keyof TokensMap];
/**
 * Configuration accepted by the parser
 */
export type ParserConfig = {
    /**
     * When set to true, the non-enumerable properties of an
     * object will be processed.
     *
     * Defaults to false
     */
    showHidden?: boolean;
    /**
     * The depth at which to stop parsing nested values. The depth
     * is shared among all tree like data structures.
     *
     * Defaults to 5
     */
    depth?: number;
    /**
     * Inspect prototype properties of an object. The non-enumerable properties
     * of prototype are included by default.
     *
     * Defaults to "unless-plain-object"
     *
     * - The "unless-plain-object" will inspect the prototype of objects
     *   created with a prototype other than the "Object"
     * - True will inspect the prototype for all objects that has a prototype
     * - False will not inpsect the prototype
     */
    inspectObjectPrototype?: boolean | 'unless-plain-object';
    /**
     * Inspect prototype properties of an array. The non-enumerable properties
     * of prototype are included by default.
     *
     * Defaults to false
     */
    inspectArrayPrototype?: boolean;
    /**
     * Inspect static members of a class. Even though functions and classes are
     * technically same, this config only applies to functions defined using
     * the [class] keyword.
     *
     * Defaults to false
     */
    inspectStaticMembers?: boolean;
    /**
     * Maximum number of members to process for Arrays, Maps and Sets.
     *
     * Defaults to 100
     */
    maxArrayLength?: number;
    /**
     * Maximum number of characters to display for a string.
     *
     * Defaults to 1000
     */
    maxStringLength?: number;
    /**
     * An array of values that must be collapsed. The objects and
     * arrays constructor names are checked against these values.
     */
    collapse?: string[];
};
