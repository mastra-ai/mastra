/*!
 * Copyright 2020 Google LLC
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
import type { GoogleError } from 'google-gax';
import { FieldPath, Firestore } from '.';
import { RateLimiter } from './rate-limiter';
import { Timestamp } from './timestamp';
import { WriteBatch, WriteResult } from './write-batch';
import GrpcStatus = FirebaseFirestore.GrpcStatus;
/*!
 * The maximum number of writes can be can in a single batch that is being retried.
 */
export declare const RETRY_MAX_BATCH_SIZE = 10;
/*!
 * The starting maximum number of operations per second as allowed by the
 * 500/50/5 rule.
 *
 * https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic.
 */
export declare const DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT = 500;
/*!
 * The maximum number of operations per second as allowed by the 500/50/5 rule.
 * By default the rate limiter will not exceed this value.
 *
 * https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic.
 */
export declare const DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT = 10000;
/*!
 * The default jitter to apply to the exponential backoff used in retries. For
 * example, a factor of 0.3 means a 30% jitter is applied.
 */
export declare const DEFAULT_JITTER_FACTOR = 0.3;
/**
 * Represents a single write for BulkWriter, encapsulating operation dispatch
 * and error handling.
 * @private
 * @internal
 */
declare class BulkWriterOperation {
    readonly ref: firestore.DocumentReference<unknown>;
    private readonly type;
    private readonly sendFn;
    private readonly errorFn;
    private readonly successFn;
    private deferred;
    private failedAttempts;
    private lastStatus?;
    private _backoffDuration;
    /** Whether flush() was called when this was the last enqueued operation. */
    private _flushed;
    /**
     * @param ref The document reference being written to.
     * @param type The type of operation that created this write.
     * @param sendFn A callback to invoke when the operation should be sent.
     * @param errorFn The user provided global error callback.
     * @param successFn The user provided global success callback.
     */
    constructor(ref: firestore.DocumentReference<unknown>, type: 'create' | 'set' | 'update' | 'delete', sendFn: (op: BulkWriterOperation) => void, errorFn: (error: BulkWriterError) => boolean, successFn: (ref: firestore.DocumentReference<unknown>, result: WriteResult) => void);
    get promise(): Promise<WriteResult>;
    get backoffDuration(): number;
    markFlushed(): void;
    get flushed(): boolean;
    onError(error: GoogleError): void;
    private updateBackoffDuration;
    onSuccess(result: WriteResult): void;
}
/**
 * Used to represent a batch on the BatchQueue.
 *
 * @private
 * @internal
 */
declare class BulkCommitBatch extends WriteBatch {
    readonly docPaths: Set<string>;
    readonly pendingOps: Array<BulkWriterOperation>;
    private _maxBatchSize;
    constructor(firestore: Firestore, maxBatchSize: number);
    get maxBatchSize(): number;
    setMaxBatchSize(size: number): void;
    has(documentRef: firestore.DocumentReference<unknown>): boolean;
    bulkCommit(options?: {
        requestTag?: string;
    }): Promise<void>;
    /**
     * Helper to update data structures associated with the operation and returns
     * the result.
     */
    processLastOperation(op: BulkWriterOperation): void;
}
/**
 * The error thrown when a BulkWriter operation fails.
 *
 * @class BulkWriterError
 */
export declare class BulkWriterError extends Error {
    /** The status code of the error. */
    readonly code: GrpcStatus;
    /** The error message of the error. */
    readonly message: string;
    /** The document reference the operation was performed on. */
    readonly documentRef: firestore.DocumentReference<any, any>;
    /** The type of operation performed. */
    readonly operationType: 'create' | 'set' | 'update' | 'delete';
    /** How many times this operation has been attempted unsuccessfully. */
    readonly failedAttempts: number;
    /**
     * @private
     * @internal
     */
    constructor(
    /** The status code of the error. */
    code: GrpcStatus, 
    /** The error message of the error. */
    message: string, 
    /** The document reference the operation was performed on. */
    documentRef: firestore.DocumentReference<any, any>, 
    /** The type of operation performed. */
    operationType: 'create' | 'set' | 'update' | 'delete', 
    /** How many times this operation has been attempted unsuccessfully. */
    failedAttempts: number);
}
/**
 * A Firestore BulkWriter that can be used to perform a large number of writes
 * in parallel.
 *
 * @class BulkWriter
 */
export declare class BulkWriter {
    private readonly firestore;
    /**
     * The maximum number of writes that can be in a single batch.
     * Visible for testing.
     * @private
     * @internal
     */
    private _maxBatchSize;
    /**
     * The batch that is currently used to schedule operations. Once this batch
     * reaches maximum capacity, a new batch is created.
     * @private
     * @internal
     */
    private _bulkCommitBatch;
    /**
     * A pointer to the tail of all active BulkWriter operations. This pointer
     * is advanced every time a new write is enqueued.
     * @private
     * @internal
     */
    private _lastOp;
    /**
     * When this BulkWriter instance has started to close, a flush promise is
     * saved. Afterwards, no new operations can be enqueued, except for retry
     * operations scheduled by the error handler.
     * @private
     * @internal
     */
    private _closePromise;
    /**
     * Rate limiter used to throttle requests as per the 500/50/5 rule.
     * Visible for testing.
     * @private
     * @internal
     */
    readonly _rateLimiter: RateLimiter;
    /**
     * The number of pending operations enqueued on this BulkWriter instance.
     * An operation is considered pending if BulkWriter has sent it via RPC and
     * is awaiting the result.
     * @private
     * @internal
     */
    private _pendingOpsCount;
    /**
     * An array containing buffered BulkWriter operations after the maximum number
     * of pending operations has been enqueued.
     * @private
     * @internal
     */
    private _bufferedOperations;
    /**
     * Whether a custom error handler has been set. BulkWriter only swallows
     * errors if an error handler is set. Otherwise, an UnhandledPromiseRejection
     * is thrown by Node if an operation promise is rejected without being
     * handled.
     * @private
     * @internal
     */
    private _errorHandlerSet;
    /**
     * @private
     * @internal
     */
    _getBufferedOperationsCount(): number;
    /**
     * @private
     * @internal
     */
    _setMaxBatchSize(size: number): void;
    /**
     * The maximum number of pending operations that can be enqueued onto this
     * BulkWriter instance. Once the this number of writes have been enqueued,
     * subsequent writes are buffered.
     * @private
     * @internal
     */
    private _maxPendingOpCount;
    /**
     * @private
     * @internal
     */
    _setMaxPendingOpCount(newMax: number): void;
    /**
     * The user-provided callback to be run every time a BulkWriter operation
     * successfully completes.
     * @private
     * @internal
     */
    private _successFn;
    /**
     * The user-provided callback to be run every time a BulkWriter operation
     * fails.
     * @private
     * @internal
     */
    private _errorFn;
    /** @private */
    constructor(firestore: Firestore, options?: firestore.BulkWriterOptions);
    /**
     * Create a document with the provided data. This single operation will fail
     * if a document exists at its location.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * created.
     * @param {T} data The object to serialize as the document.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {Promise<WriteResult>} A promise that resolves with the result of
     * the write. If the write fails, the promise is rejected with a
     * [BulkWriterError]{@link BulkWriterError}.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     * let documentRef = firestore.collection('col').doc();
     *
     * bulkWriter
     *  .create(documentRef, {foo: 'bar'})
     *  .then(result => {
     *    console.log('Successfully executed write at: ', result);
     *  })
     *  .catch(err => {
     *    console.log('Write failed with: ', err);
     *  });
     * });
     * ```
     */
    create<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.WithFieldValue<AppModelType>): Promise<WriteResult>;
    /**
     * Delete a document from the database.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * deleted.
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the batch if the
     * document doesn't exist or was last updated at a different time.
     * @returns {Promise<WriteResult>} A promise that resolves with the result of
     * the delete. If the delete fails, the promise is rejected with a
     * [BulkWriterError]{@link BulkWriterError}.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     * let documentRef = firestore.doc('col/doc');
     *
     * bulkWriter
     *  .delete(documentRef)
     *  .then(result => {
     *    console.log('Successfully deleted document');
     *  })
     *  .catch(err => {
     *    console.log('Delete failed with: ', err);
     *  });
     * });
     * ```
     */
    delete<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, precondition?: firestore.Precondition): Promise<WriteResult>;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: Partial<AppModelType>, options: firestore.SetOptions): Promise<WriteResult>;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: AppModelType): Promise<WriteResult>;
    /**
     * Update fields of the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document doesn't yet
     * exist, the update fails and the entire batch will be rejected.
     *
     * The update() method accepts either an object with field paths encoded as
     * keys and field values encoded as values, or a variable number of arguments
     * that alternate between field paths and field values. Nested fields can be
     * updated by providing dot-separated field path strings or by providing
     * FieldPath objects.
     *
     *
     * A Precondition restricting this update can be specified as the last
     * argument.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * updated.
     * @param {UpdateData|string|FieldPath} dataOrField An object containing the
     * fields and values with which to update the document or the path of the
     * first field to update.
     * @param {...(Precondition|*|string|FieldPath)} preconditionOrValues - An
     * alternating list of field paths and values to update or a Precondition to
     * restrict this update
     * @throws {Error} If the provided input is not valid Firestore data.
     * @returns {Promise<WriteResult>} A promise that resolves with the result of
     * the write. If the write fails, the promise is rejected with a
     * [BulkWriterError]{@link BulkWriterError}.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     * let documentRef = firestore.doc('col/doc');
     *
     * bulkWriter
     *  .update(documentRef, {foo: 'bar'})
     *  .then(result => {
     *    console.log('Successfully executed write at: ', result);
     *  })
     *  .catch(err => {
     *    console.log('Write failed with: ', err);
     *  });
     * });
     * ```
     */
    update<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, dataOrField: firestore.UpdateData<DbModelType> | string | FieldPath, ...preconditionOrValues: Array<{
        lastUpdateTime?: Timestamp;
    } | unknown | string | FieldPath>): Promise<WriteResult>;
    /**
     * Callback function set by {@link BulkWriter#onWriteResult} that is run
     * every time a {@link BulkWriter} operation successfully completes.
     *
     * @callback BulkWriter~successCallback
     * @param {DocumentReference} documentRef The document reference the
     * operation was performed on
     * @param {WriteResult} result The server write time of the operation.
     */
    /**
     * Attaches a listener that is run every time a BulkWriter operation
     * successfully completes.
     *
     * @param {BulkWriter~successCallback} successCallback A callback to be
     * called every time a BulkWriter operation successfully completes.
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     *
     * bulkWriter
     *   .onWriteResult((documentRef, result) => {
     *     console.log(
     *       'Successfully executed write on document: ',
     *       documentRef,
     *       ' at: ',
     *       result
     *     );
     *   });
     * ```
     */
    onWriteResult(successCallback: (documentRef: firestore.DocumentReference<any, any>, result: WriteResult) => void): void;
    /**
     * Callback function set by {@link BulkWriter#onWriteError} that is run when
     * a write fails in order to determine whether {@link BulkWriter} should
     * retry the operation.
     *
     * @callback BulkWriter~shouldRetryCallback
     * @param {BulkWriterError} error The error object with information about the
     * operation and error.
     * @returns {boolean} Whether or not to retry the failed operation. Returning
     * `true` retries the operation. Returning `false` will stop the retry loop.
     */
    /**
     * Attaches an error handler listener that is run every time a BulkWriter
     * operation fails.
     *
     * BulkWriter has a default error handler that retries UNAVAILABLE and
     * ABORTED errors up to a maximum of 10 failed attempts. When an error
     * handler is specified, the default error handler will be overwritten.
     *
     * @param shouldRetryCallback {BulkWriter~shouldRetryCallback} A callback to
     * be called every time a BulkWriter operation fails. Returning `true` will
     * retry the operation. Returning `false` will stop the retry loop.
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     *
     * bulkWriter
     *   .onWriteError((error) => {
     *     if (
     *       error.code === GrpcStatus.UNAVAILABLE &&
     *       error.failedAttempts < MAX_RETRY_ATTEMPTS
     *     ) {
     *       return true;
     *     } else {
     *       console.log('Failed write at document: ', error.documentRef);
     *       return false;
     *     }
     *   });
     * ```
     */
    onWriteError(shouldRetryCallback: (error: BulkWriterError) => boolean): void;
    /**
     * Commits all writes that have been enqueued up to this point in parallel.
     *
     * Returns a Promise that resolves when all currently queued operations have
     * been committed. The Promise will never be rejected since the results for
     * each individual operation are conveyed via their individual Promises.
     *
     * The Promise resolves immediately if there are no pending writes. Otherwise,
     * the Promise waits for all previously issued writes, but it does not wait
     * for writes that were added after the method is called. If you want to wait
     * for additional writes, call `flush()` again.
     *
     * @return {Promise<void>} A promise that resolves when all enqueued writes
     * up to this point have been committed.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     *
     * bulkWriter.create(documentRef, {foo: 'bar'});
     * bulkWriter.update(documentRef2, {foo: 'bar'});
     * bulkWriter.delete(documentRef3);
     * await flush().then(() => {
     *   console.log('Executed all writes');
     * });
     * ```
     */
    flush(): Promise<void>;
    /**
     * Commits all enqueued writes and marks the BulkWriter instance as closed.
     *
     * After calling `close()`, calling any method will throw an error. Any
     * retries scheduled as part of an `onWriteError()` handler will be run
     * before the `close()` promise resolves.
     *
     * Returns a Promise that resolves when there are no more pending writes. The
     * Promise will never be rejected. Calling this method will send all requests.
     * The promise resolves immediately if there are no pending writes.
     *
     * @return {Promise<void>} A promise that resolves when all enqueued writes
     * up to this point have been committed.
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     *
     * bulkWriter.create(documentRef, {foo: 'bar'});
     * bulkWriter.update(documentRef2, {foo: 'bar'});
     * bulkWriter.delete(documentRef3);
     * await close().then(() => {
     *   console.log('Executed all writes');
     * });
     * ```
     */
    close(): Promise<void>;
    /**
     * Throws an error if the BulkWriter instance has been closed.
     * @private
     * @internal
     */
    _verifyNotClosed(): void;
    /**
     * Sends the current batch and resets `this._bulkCommitBatch`.
     *
     * @param flush If provided, keeps re-sending operations until no more
     * operations are enqueued. This allows retries to resolve as part of a
     * `flush()` or `close()` call.
     * @private
     * @internal
     */
    private _scheduleCurrentBatch;
    /**
     * Sends the provided batch once the rate limiter does not require any delay.
     * @private
     * @internal
     */
    private _sendBatch;
    /**
     * Adds a 30% jitter to the provided backoff.
     *
     * @private
     * @internal
     */
    private static _applyJitter;
    /**
     * Schedules and runs the provided operation on the next available batch.
     * @private
     * @internal
     */
    private _enqueue;
    /**
     * Manages the pending operation counter and schedules the next BulkWriter
     * operation if we're under the maximum limit.
     * @private
     * @internal
     */
    private _processBufferedOps;
    /**
     * Schedules the provided operations on current BulkCommitBatch.
     * Sends the BulkCommitBatch if it reaches maximum capacity.
     *
     * @private
     * @internal
     */
    _sendFn(enqueueOnBatchCallback: (bulkCommitBatch: BulkCommitBatch) => void, op: BulkWriterOperation): void;
}
export {};
