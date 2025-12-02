/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { DocumentData } from '@google-cloud/firestore';
import type { GoogleError } from 'google-gax';
import type { BackoffSettings } from 'google-gax/build/src/gax';
import Dict = NodeJS.Dict;
/**
 * A Promise implementation that supports deferred resolution.
 * @private
 * @internal
 */
export declare class Deferred<R> {
    promise: Promise<R>;
    resolve: (value: R | Promise<R>) => void;
    reject: (reason: Error) => void;
    constructor();
}
/**
 * Generate a unique client-side identifier.
 *
 * Used for the creation of new documents.
 *
 * @private
 * @internal
 * @returns {string} A unique 20-character wide identifier.
 */
export declare function autoId(): string;
/**
 * Generate a short and semi-random client-side identifier.
 *
 * Used for the creation of request tags.
 *
 * @private
 * @internal
 * @returns {string} A random 5-character wide identifier.
 */
export declare function requestTag(): string;
/**
 * Determines whether `value` is a JavaScript object.
 *
 * @private
 * @internal
 */
export declare function isObject(value: unknown): value is {
    [k: string]: unknown;
};
/**
 * Verifies that 'obj' is a plain JavaScript object that can be encoded as a
 * 'Map' in Firestore.
 *
 * @private
 * @internal
 * @param input The argument to verify.
 * @returns 'true' if the input can be a treated as a plain object.
 */
export declare function isPlainObject(input: unknown): input is DocumentData;
/**
 * Returns whether `value` has no custom properties.
 *
 * @private
 * @internal
 */
export declare function isEmpty(value: {}): boolean;
/**
 * Determines whether `value` is a JavaScript function.
 *
 * @private
 * @internal
 */
export declare function isFunction(value: unknown): boolean;
/**
 * Determines whether the provided error is considered permanent for the given
 * RPC.
 *
 * @private
 * @internal
 */
export declare function isPermanentRpcError(err: GoogleError, methodName: string): boolean;
/**
 * Returns the list of retryable error codes specified in the service
 * configuration.
 * @private
 * @internal
 */
export declare function getRetryCodes(methodName: string): number[];
/**
 * Gets the total timeout in milliseconds from the retry settings in
 * the service config for the given RPC. If the total timeout is not
 * set, then `0` is returned.
 *
 * @private
 * @internal
 */
export declare function getTotalTimeout(methodName: string): number;
/**
 * Returns the backoff setting from the service configuration.
 * @private
 * @internal
 */
export declare function getRetryParams(methodName: string): BackoffSettings;
/**
 * Returns a promise with a void return type. The returned promise swallows all
 * errors and never throws.
 *
 * This is primarily used to wait for a promise to complete when the result of
 * the promise will be discarded.
 *
 * @private
 * @internal
 */
export declare function silencePromise(promise: Promise<unknown>): Promise<void>;
/**
 * Wraps the provided error in a new error that includes the provided stack.
 *
 * Used to preserve stack traces across async calls.
 * @private
 * @internal
 */
export declare function wrapError(err: Error, stack: string): Error;
/**
 * Parses the value of the environment variable FIRESTORE_PREFER_REST, and
 * returns a value indicating if the environment variable enables or disables
 * preferRest.
 *
 * This function will warn to the console if the environment variable is set
 * to an unsupported value.
 *
 * @return `true` if the environment variable enables `preferRest`,
 * `false` if the environment variable disables `preferRest`, or `undefined`
 * if the environment variable is not set or is set to an unsupported value.
 *
 * @internal
 * @private
 */
export declare function tryGetPreferRestEnvironmentVariable(): boolean | undefined;
/**
 * Returns an array of values that are calculated by performing the given `fn`
 * on all keys in the given `obj` dictionary.
 *
 * @private
 * @internal
 */
export declare function mapToArray<V, R>(obj: Dict<V>, fn: (element: V, key: string, obj: Dict<V>) => R): R[];
/**
 * Verifies equality for an array of objects using the `isEqual` interface.
 *
 * @private
 * @internal
 * @param left Array of objects supporting `isEqual`.
 * @param right Array of objects supporting `isEqual`.
 * @return True if arrays are equal.
 */
export declare function isArrayEqual<T extends {
    isEqual: (t: T) => boolean;
}>(left: T[], right: T[]): boolean;
/**
 * Verifies equality for an array of primitives.
 *
 * @private
 * @internal
 * @param left Array of primitives.
 * @param right Array of primitives.
 * @return True if arrays are equal.
 */
export declare function isPrimitiveArrayEqual<T extends number | string>(left: T[], right: T[]): boolean;
