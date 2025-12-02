/// <reference types="node" />
/// <reference types="node" />
import { DurabilityLevel } from './generaltypes';
/**
 * CAS represents an opaque value which can be used to compare documents to
 * determine if a change has occurred.
 *
 * @category Key-Value
 */
export interface Cas {
    /**
     * Generates a string representation of this CAS.
     */
    toString(): string;
    /**
     * Generates a JSON representation of this CAS.
     */
    toJSON(): any;
}
/**
 * CasIn represents the supported types that can be provided to an operation
 * that receive a CAS.
 *
 * @category Key-Value
 */
export type CasInput = Cas | string | Buffer;
/**
 * Reprents a node-style callback which receives an optional error or result.
 *
 * @category Utilities
 */
export interface NodeCallback<T> {
    (err: Error | null, result: T | null): void;
}
/**
 * @internal
 */
export declare class PromiseHelper {
    /**
     * @internal
     */
    static wrapAsync<T, U extends Promise<T>>(fn: () => U, callback?: (err: Error | null, result: T | null) => void): U;
    /**
     * @internal
     */
    static wrap<T>(fn: (callback: NodeCallback<T>) => void, callback?: NodeCallback<T> | null): Promise<T>;
}
/**
 * @internal
 */
export declare class CompoundTimeout {
    private _start;
    private _timeout;
    /**
     * @internal
     */
    constructor(timeout: number | undefined);
    /**
     * @internal
     */
    left(): number | undefined;
    /**
     * @internal
     */
    expired(): boolean;
}
/**
 * @internal
 */
export declare function duraLevelToNsServerStr(level: DurabilityLevel | string | undefined): string | undefined;
/**
 * @internal
 */
export declare function nsServerStrToDuraLevel(level: string | undefined): DurabilityLevel;
/**
 * @internal
 */
export declare function cbQsStringify(values: {
    [key: string]: any;
}, options?: {
    boolAsString?: boolean;
}): string;
/**
 * @internal
 */
export declare function parseExpiry(expiry?: number | Date): number;
