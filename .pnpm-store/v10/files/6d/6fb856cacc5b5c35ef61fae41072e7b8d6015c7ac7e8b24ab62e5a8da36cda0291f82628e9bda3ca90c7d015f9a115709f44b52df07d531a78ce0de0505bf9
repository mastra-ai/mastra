/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
import { PromisifyOptions } from '@google-cloud/promisify';
import { Duration } from './temporal';
/**
 * This replaces usage of promisifyAll(), going forward. Instead of opting
 * some methods out, you will need to opt methods in. Additionally, this
 * function validates method names against the class using TypeScript,
 * to generate compile-time failures for misspellings and changes.
 *
 * Future work in the library should all be Promise-first.
 *
 * @private
 */
export declare function promisifySome<T>(class_: Function, classProto: T, methods: (keyof T)[], options?: PromisifyOptions): void;
export declare function noop(): void;
/**
 * Provides a very simple throttling capability for tasks like error logs.
 * This ensures that no task is actually completed unless N millis have passed
 * since the last one.
 *
 * @private
 */
export declare class Throttler {
    minMillis: number;
    lastTime?: number;
    constructor(minMillis: number);
    /**
     * Performs the task requested, if enough time has passed since the
     * last successful call.
     */
    doMaybe(task: Function): void;
}
/**
 * Takes care of managing a Map of buckets to the bucket arrays themselves.
 *
 * @private
 */
export declare function addToBucket<T, U>(map: Map<T, U[]>, bucket: T, item: U): void;
/**
 * Return value from `awaitWithTimeout`. There are several variations on what
 * might happen here, so this bundles it all up into a "report".
 */
export interface TimeoutReturn<T> {
    returnedValue?: T;
    exception?: Error;
    timedOut: boolean;
}
/**
 * Awaits on Promise with a timeout. Resolves on the passed promise resolving or
 * rejecting, or on timeout.
 *
 * @param promise An existing Promise returning type T.
 * @param timeout A timeout value as a Duration; if the timeout is exceeded while
 *   waiting for the promise, the Promise this function returns will resolve, but
 *   with `timedOut` set.
 * @returns A TimeoutReturn with the returned value, if applicable, an exception if
 *   the promise rejected, or the timedOut set to true if it timed out.
 */
export declare function awaitWithTimeout<T>(promise: Promise<T>, timeout: Duration): Promise<TimeoutReturn<T>>;
