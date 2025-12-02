/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { DatabaseReference } from './Reference';
import { DataSnapshot } from './Reference_impl';
/** An options object to configure transactions. */
export interface TransactionOptions {
    /**
     * By default, events are raised each time the transaction update function
     * runs. So if it is run multiple times, you may see intermediate states. You
     * can set this to false to suppress these intermediate states and instead
     * wait until the transaction has completed before events are raised.
     */
    readonly applyLocally?: boolean;
}
/**
 * A type for the resolve value of {@link runTransaction}.
 */
export declare class TransactionResult {
    /** Whether the transaction was successfully committed. */
    readonly committed: boolean;
    /** The resulting data snapshot. */
    readonly snapshot: DataSnapshot;
    /** @hideconstructor */
    constructor(
    /** Whether the transaction was successfully committed. */
    committed: boolean, 
    /** The resulting data snapshot. */
    snapshot: DataSnapshot);
    /** Returns a JSON-serializable representation of this object. */
    toJSON(): object;
}
/**
 * Atomically modifies the data at this location.
 *
 * Atomically modify the data at this location. Unlike a normal `set()`, which
 * just overwrites the data regardless of its previous value, `runTransaction()` is
 * used to modify the existing value to a new value, ensuring there are no
 * conflicts with other clients writing to the same location at the same time.
 *
 * To accomplish this, you pass `runTransaction()` an update function which is
 * used to transform the current value into a new value. If another client
 * writes to the location before your new value is successfully written, your
 * update function will be called again with the new current value, and the
 * write will be retried. This will happen repeatedly until your write succeeds
 * without conflict or you abort the transaction by not returning a value from
 * your update function.
 *
 * Note: Modifying data with `set()` will cancel any pending transactions at
 * that location, so extreme care should be taken if mixing `set()` and
 * `runTransaction()` to update the same data.
 *
 * Note: When using transactions with Security and Firebase Rules in place, be
 * aware that a client needs `.read` access in addition to `.write` access in
 * order to perform a transaction. This is because the client-side nature of
 * transactions requires the client to read the data in order to transactionally
 * update it.
 *
 * @param ref - The location to atomically modify.
 * @param transactionUpdate - A developer-supplied function which will be passed
 * the current data stored at this location (as a JavaScript object). The
 * function should return the new value it would like written (as a JavaScript
 * object). If `undefined` is returned (i.e. you return with no arguments) the
 * transaction will be aborted and the data at this location will not be
 * modified.
 * @param options - An options object to configure transactions.
 * @returns A `Promise` that can optionally be used instead of the `onComplete`
 * callback to handle success and failure.
 */
export declare function runTransaction(ref: DatabaseReference, transactionUpdate: (currentData: any) => unknown, options?: TransactionOptions): Promise<TransactionResult>;
