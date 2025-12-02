/*!
 * Copyright 2021 Google LLC
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
import * as firestore from '@google-cloud/firestore';
import Firestore, { BulkWriter } from '.';
/*!
 * Datastore allowed numeric IDs where Firestore only allows strings. Numeric
 * IDs are exposed to Firestore as __idNUM__, so this is the lowest possible
 * negative numeric value expressed in that format.
 *
 * This constant is used to specify startAt/endAt values when querying for all
 * descendants in a single collection.
 */
export declare const REFERENCE_NAME_MIN_ID = "__id-9223372036854775808__";
/*!
 * The query limit used for recursive deletes when fetching all descendants of
 * the specified reference to delete. This is done to prevent the query stream
 * from streaming documents faster than Firestore can delete.
 */
export declare const RECURSIVE_DELETE_MAX_PENDING_OPS = 5000;
/*!
 * The number of pending BulkWriter operations at which RecursiveDelete
 * starts the next limit query to fetch descendants. By starting the query
 * while there are pending operations, Firestore can improve BulkWriter
 * throughput. This helps prevent BulkWriter from idling while Firestore
 * fetches the next query.
 */
export declare const RECURSIVE_DELETE_MIN_PENDING_OPS = 1000;
/**
 * Class used to store state required for running a recursive delete operation.
 * Each recursive delete call should use a new instance of the class.
 * @private
 * @internal
 */
export declare class RecursiveDelete {
    private readonly firestore;
    private readonly writer;
    private readonly ref;
    private readonly maxLimit;
    private readonly minLimit;
    /**
     * The number of deletes that failed with a permanent error.
     * @private
     * @internal
     */
    private errorCount;
    /**
     * The most recently thrown error. Used to populate the developer-facing
     * error message when the recursive delete operation completes.
     * @private
     * @internal
     */
    private lastError;
    /**
     * Whether there are still documents to delete that still need to be fetched.
     * @private
     * @internal
     */
    private documentsPending;
    /**
     * Whether run() has been called.
     * @private
     * @internal
     */
    private started;
    /**
     * Query limit to use when fetching all descendants.
     * @private
     * @internal
     */
    private readonly maxPendingOps;
    /**
     * The number of pending BulkWriter operations at which RecursiveDelete
     * starts the next limit query to fetch descendants.
     * @private
     * @internal
     */
    private readonly minPendingOps;
    /**
     * A deferred promise that resolves when the recursive delete operation
     * is completed.
     * @private
     * @internal
     */
    private readonly completionDeferred;
    /**
     * Whether a query stream is currently in progress. Only one stream can be
     * run at a time.
     * @private
     * @internal
     */
    private streamInProgress;
    /**
     * The last document snapshot returned by the stream. Used to set the
     * startAfter() field in the subsequent stream.
     * @private
     * @internal
     */
    private lastDocumentSnap;
    /**
     * The number of pending BulkWriter operations. Used to determine when the
     * next query can be run.
     * @private
     * @internal
     */
    private pendingOpsCount;
    private errorStack;
    /**
     *
     * @param firestore The Firestore instance to use.
     * @param writer The BulkWriter instance to use for delete operations.
     * @param ref The document or collection reference to recursively delete.
     * @param maxLimit The query limit to use when fetching descendants
     * @param minLimit The number of pending BulkWriter operations at which
     * RecursiveDelete starts the next limit query to fetch descendants.
     */
    constructor(firestore: Firestore, writer: BulkWriter, ref: firestore.CollectionReference<unknown> | firestore.DocumentReference<unknown>, maxLimit: number, minLimit: number);
    /**
     * Recursively deletes the reference provided in the class constructor.
     * Returns a promise that resolves when all descendants have been deleted, or
     * if an error occurs.
     */
    run(): Promise<void>;
    /**
     * Creates a query stream and attaches event handlers to it.
     * @private
     * @internal
     */
    private setupStream;
    /**
     * Retrieves all descendant documents nested under the provided reference.
     * @param ref The reference to fetch all descendants for.
     * @private
     * @internal
     * @return {Stream<QueryDocumentSnapshot>} Stream of descendant documents.
     */
    private getAllDescendants;
    /**
     * Called when all descendants of the provided reference have been streamed
     * or if a permanent error occurs during the stream. Deletes the developer
     * provided reference and wraps any errors that occurred.
     * @private
     * @internal
     */
    private onQueryEnd;
    /**
     * Deletes the provided reference and starts the next stream if conditions
     * are met.
     * @private
     * @internal
     */
    private deleteRef;
    private incrementErrorCount;
}
