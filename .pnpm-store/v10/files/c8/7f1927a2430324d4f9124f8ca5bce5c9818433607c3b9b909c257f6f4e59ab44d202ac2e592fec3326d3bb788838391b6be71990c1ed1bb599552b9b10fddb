"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkWriter = exports.BulkWriterError = exports.DEFAULT_JITTER_FACTOR = exports.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT = exports.DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT = exports.RETRY_MAX_BATCH_SIZE = void 0;
const assert = require("assert");
const backoff_1 = require("./backoff");
const rate_limiter_1 = require("./rate-limiter");
const timestamp_1 = require("./timestamp");
const util_1 = require("./util");
const write_batch_1 = require("./write-batch");
const validate_1 = require("./validate");
const logger_1 = require("./logger");
const trace_util_1 = require("./telemetry/trace-util");
/*!
 * The maximum number of writes that can be in a single batch.
 */
const MAX_BATCH_SIZE = 20;
/*!
 * The maximum number of writes can be can in a single batch that is being retried.
 */
exports.RETRY_MAX_BATCH_SIZE = 10;
/*!
 * The starting maximum number of operations per second as allowed by the
 * 500/50/5 rule.
 *
 * https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic.
 */
exports.DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT = 500;
/*!
 * The maximum number of operations per second as allowed by the 500/50/5 rule.
 * By default the rate limiter will not exceed this value.
 *
 * https://firebase.google.com/docs/firestore/best-practices#ramping_up_traffic.
 */
exports.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT = 10000;
/*!
 * The default jitter to apply to the exponential backoff used in retries. For
 * example, a factor of 0.3 means a 30% jitter is applied.
 */
exports.DEFAULT_JITTER_FACTOR = 0.3;
/*!
 * The rate by which to increase the capacity as specified by the 500/50/5 rule.
 */
const RATE_LIMITER_MULTIPLIER = 1.5;
/*!
 * How often the operations per second capacity should increase in milliseconds
 * as specified by the 500/50/5 rule.
 */
const RATE_LIMITER_MULTIPLIER_MILLIS = 5 * 60 * 1000;
/*!
 * The default maximum number of pending operations that can be enqueued onto a
 * BulkWriter instance. An operation is considered pending if BulkWriter has
 * sent it via RPC and is awaiting the result. BulkWriter buffers additional
 * writes after this many pending operations in order to avoiding going OOM.
 */
const DEFAULT_MAXIMUM_PENDING_OPERATIONS_COUNT = 500;
/**
 * Represents a single write for BulkWriter, encapsulating operation dispatch
 * and error handling.
 * @private
 * @internal
 */
class BulkWriterOperation {
    /**
     * @param ref The document reference being written to.
     * @param type The type of operation that created this write.
     * @param sendFn A callback to invoke when the operation should be sent.
     * @param errorFn The user provided global error callback.
     * @param successFn The user provided global success callback.
     */
    constructor(ref, type, sendFn, errorFn, successFn) {
        this.ref = ref;
        this.type = type;
        this.sendFn = sendFn;
        this.errorFn = errorFn;
        this.successFn = successFn;
        this.deferred = new util_1.Deferred();
        this.failedAttempts = 0;
        this._backoffDuration = 0;
        /** Whether flush() was called when this was the last enqueued operation. */
        this._flushed = false;
    }
    get promise() {
        return this.deferred.promise;
    }
    get backoffDuration() {
        return this._backoffDuration;
    }
    markFlushed() {
        this._flushed = true;
    }
    get flushed() {
        return this._flushed;
    }
    onError(error) {
        ++this.failedAttempts;
        try {
            const bulkWriterError = new BulkWriterError(error.code, error.message, this.ref, this.type, this.failedAttempts);
            const shouldRetry = this.errorFn(bulkWriterError);
            (0, logger_1.logger)('BulkWriter.errorFn', null, 'Ran error callback on error code:', error.code, ', shouldRetry:', shouldRetry, ' for document:', this.ref.path);
            if (shouldRetry) {
                this.lastStatus = error.code;
                this.updateBackoffDuration();
                this.sendFn(this);
            }
            else {
                this.deferred.reject(bulkWriterError);
            }
        }
        catch (userCallbackError) {
            this.deferred.reject(userCallbackError);
        }
    }
    updateBackoffDuration() {
        if (this.lastStatus === 8 /* StatusCode.RESOURCE_EXHAUSTED */) {
            this._backoffDuration = backoff_1.DEFAULT_BACKOFF_MAX_DELAY_MS;
        }
        else if (this._backoffDuration === 0) {
            this._backoffDuration = backoff_1.DEFAULT_BACKOFF_INITIAL_DELAY_MS;
        }
        else {
            this._backoffDuration *= backoff_1.DEFAULT_BACKOFF_FACTOR;
        }
    }
    onSuccess(result) {
        try {
            this.successFn(this.ref, result);
            this.deferred.resolve(result);
        }
        catch (userCallbackError) {
            this.deferred.reject(userCallbackError);
        }
    }
}
/**
 * Used to represent a batch on the BatchQueue.
 *
 * @private
 * @internal
 */
class BulkCommitBatch extends write_batch_1.WriteBatch {
    constructor(firestore, maxBatchSize) {
        super(firestore);
        // The set of document reference paths present in the WriteBatch.
        this.docPaths = new Set();
        // An array of pending write operations. Only contains writes that have not
        // been resolved.
        this.pendingOps = [];
        this._maxBatchSize = maxBatchSize;
    }
    get maxBatchSize() {
        return this._maxBatchSize;
    }
    setMaxBatchSize(size) {
        assert(this.pendingOps.length <= size, 'New batch size cannot be less than the number of enqueued writes');
        this._maxBatchSize = size;
    }
    has(documentRef) {
        return this.docPaths.has(documentRef.path);
    }
    async bulkCommit(options = {}) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_BULK_WRITER_COMMIT, async () => {
            var _a;
            const tag = (_a = options === null || options === void 0 ? void 0 : options.requestTag) !== null && _a !== void 0 ? _a : (0, util_1.requestTag)();
            // Capture the error stack to preserve stack tracing across async calls.
            const stack = Error().stack;
            let response;
            try {
                (0, logger_1.logger)('BulkCommitBatch.bulkCommit', tag, `Sending next batch with ${this._opCount} writes`);
                const retryCodes = (0, util_1.getRetryCodes)('batchWrite');
                response = await this._commit({ retryCodes, methodName: 'batchWrite', requestTag: tag });
            }
            catch (err) {
                // Map the failure to each individual write's result.
                const ops = Array.from({ length: this.pendingOps.length });
                response = {
                    writeResults: ops.map(() => {
                        return {};
                    }),
                    status: ops.map(() => err),
                };
            }
            for (let i = 0; i < (response.writeResults || []).length; ++i) {
                // Since delete operations currently do not have write times, use a
                // sentinel Timestamp value.
                // TODO(b/158502664): Use actual delete timestamp.
                const DELETE_TIMESTAMP_SENTINEL = timestamp_1.Timestamp.fromMillis(0);
                const status = (response.status || [])[i];
                if (status.code === 0 /* StatusCode.OK */) {
                    const updateTime = timestamp_1.Timestamp.fromProto(response.writeResults[i].updateTime || DELETE_TIMESTAMP_SENTINEL);
                    this.pendingOps[i].onSuccess(new write_batch_1.WriteResult(updateTime));
                }
                else {
                    const error = new (require('google-gax/build/src/fallback').GoogleError)(status.message || undefined);
                    error.code = status.code;
                    this.pendingOps[i].onError((0, util_1.wrapError)(error, stack));
                }
            }
        }, {
            [trace_util_1.ATTRIBUTE_KEY_DOC_COUNT]: this._opCount,
        });
    }
    /**
     * Helper to update data structures associated with the operation and returns
     * the result.
     */
    processLastOperation(op) {
        assert(!this.docPaths.has(op.ref.path), 'Batch should not contain writes to the same document');
        this.docPaths.add(op.ref.path);
        this.pendingOps.push(op);
    }
}
/**
 * Used to represent a buffered BulkWriterOperation.
 *
 * @private
 * @internal
 */
class BufferedOperation {
    constructor(operation, sendFn) {
        this.operation = operation;
        this.sendFn = sendFn;
    }
}
/**
 * The error thrown when a BulkWriter operation fails.
 *
 * @class BulkWriterError
 */
class BulkWriterError extends Error {
    /**
     * @private
     * @internal
     */
    constructor(
    /** The status code of the error. */
    code, 
    /** The error message of the error. */
    message, 
    /** The document reference the operation was performed on. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentRef, 
    /** The type of operation performed. */
    operationType, 
    /** How many times this operation has been attempted unsuccessfully. */
    failedAttempts) {
        super(message);
        this.code = code;
        this.message = message;
        this.documentRef = documentRef;
        this.operationType = operationType;
        this.failedAttempts = failedAttempts;
    }
}
exports.BulkWriterError = BulkWriterError;
/**
 * A Firestore BulkWriter that can be used to perform a large number of writes
 * in parallel.
 *
 * @class BulkWriter
 */
class BulkWriter {
    // Visible for testing.
    /**
     * @private
     * @internal
     */
    _getBufferedOperationsCount() {
        return this._bufferedOperations.length;
    }
    // Visible for testing.
    /**
     * @private
     * @internal
     */
    _setMaxBatchSize(size) {
        assert(this._bulkCommitBatch.pendingOps.length === 0, 'BulkCommitBatch should be empty');
        this._maxBatchSize = size;
        this._bulkCommitBatch = new BulkCommitBatch(this.firestore, size);
    }
    // Visible for testing.
    /**
     * @private
     * @internal
     */
    _setMaxPendingOpCount(newMax) {
        this._maxPendingOpCount = newMax;
    }
    /** @private */
    constructor(firestore, options) {
        var _a, _b;
        this.firestore = firestore;
        /**
         * The maximum number of writes that can be in a single batch.
         * Visible for testing.
         * @private
         * @internal
         */
        this._maxBatchSize = MAX_BATCH_SIZE;
        /**
         * The batch that is currently used to schedule operations. Once this batch
         * reaches maximum capacity, a new batch is created.
         * @private
         * @internal
         */
        this._bulkCommitBatch = new BulkCommitBatch(this.firestore, this._maxBatchSize);
        /**
         * A pointer to the tail of all active BulkWriter operations. This pointer
         * is advanced every time a new write is enqueued.
         * @private
         * @internal
         */
        this._lastOp = Promise.resolve();
        /**
         * The number of pending operations enqueued on this BulkWriter instance.
         * An operation is considered pending if BulkWriter has sent it via RPC and
         * is awaiting the result.
         * @private
         * @internal
         */
        this._pendingOpsCount = 0;
        /**
         * An array containing buffered BulkWriter operations after the maximum number
         * of pending operations has been enqueued.
         * @private
         * @internal
         */
        this._bufferedOperations = [];
        /**
         * Whether a custom error handler has been set. BulkWriter only swallows
         * errors if an error handler is set. Otherwise, an UnhandledPromiseRejection
         * is thrown by Node if an operation promise is rejected without being
         * handled.
         * @private
         * @internal
         */
        this._errorHandlerSet = false;
        /**
         * The maximum number of pending operations that can be enqueued onto this
         * BulkWriter instance. Once the this number of writes have been enqueued,
         * subsequent writes are buffered.
         * @private
         * @internal
         */
        this._maxPendingOpCount = DEFAULT_MAXIMUM_PENDING_OPERATIONS_COUNT;
        /**
         * The user-provided callback to be run every time a BulkWriter operation
         * successfully completes.
         * @private
         * @internal
         */
        this._successFn = () => { };
        /**
         * The user-provided callback to be run every time a BulkWriter operation
         * fails.
         * @private
         * @internal
         */
        this._errorFn = error => {
            const isRetryableDeleteError = error.operationType === 'delete' &&
                error.code === 13 /* StatusCode.INTERNAL */;
            const retryCodes = (0, util_1.getRetryCodes)('batchWrite');
            return ((retryCodes.includes(error.code) || isRetryableDeleteError) &&
                error.failedAttempts < backoff_1.MAX_RETRY_ATTEMPTS);
        };
        this.firestore._incrementBulkWritersCount();
        validateBulkWriterOptions(options);
        if ((options === null || options === void 0 ? void 0 : options.throttling) === false) {
            this._rateLimiter = new rate_limiter_1.RateLimiter(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        }
        else {
            let startingRate = exports.DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT;
            let maxRate = exports.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT;
            if (typeof (options === null || options === void 0 ? void 0 : options.throttling) !== 'boolean') {
                if (((_a = options === null || options === void 0 ? void 0 : options.throttling) === null || _a === void 0 ? void 0 : _a.maxOpsPerSecond) !== undefined) {
                    maxRate = options.throttling.maxOpsPerSecond;
                }
                if (((_b = options === null || options === void 0 ? void 0 : options.throttling) === null || _b === void 0 ? void 0 : _b.initialOpsPerSecond) !== undefined) {
                    startingRate = options.throttling.initialOpsPerSecond;
                }
                // The initial validation step ensures that the maxOpsPerSecond is
                // greater than initialOpsPerSecond. If this inequality is true, that
                // means initialOpsPerSecond was not set and maxOpsPerSecond is less
                // than the default starting rate.
                if (maxRate < startingRate) {
                    startingRate = maxRate;
                }
                // Ensure that the batch size is not larger than the number of allowed
                // operations per second.
                if (startingRate < this._maxBatchSize) {
                    this._maxBatchSize = startingRate;
                }
            }
            this._rateLimiter = new rate_limiter_1.RateLimiter(startingRate, RATE_LIMITER_MULTIPLIER, RATE_LIMITER_MULTIPLIER_MILLIS, maxRate);
        }
    }
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
    create(documentRef, data) {
        this._verifyNotClosed();
        return this._enqueue(documentRef, 'create', bulkCommitBatch => bulkCommitBatch.create(documentRef, data));
    }
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
    delete(documentRef, precondition) {
        this._verifyNotClosed();
        return this._enqueue(documentRef, 'delete', bulkCommitBatch => bulkCommitBatch.delete(documentRef, precondition));
    }
    /**
     * Write to the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document does not
     * exist yet, it will be created. If you pass [SetOptions]{@link SetOptions}.,
     * the provided data can be merged into the existing document.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * set.
     * @param {T} data The object to serialize as the document.
     * @param {SetOptions=} options An object to configure the set behavior.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @param {boolean=} options.merge - If true, set() merges the values
     * specified in its data argument. Fields omitted from this set() call remain
     * untouched. If your input sets any field to an empty map, all nested fields
     * are overwritten.
     * @param {Array.<string|FieldPath>=} options.mergeFields - If provided, set()
     * only replaces the specified field paths. Any field path that is not
     * specified is ignored and remains untouched. If your input sets any field to
     * an empty map, all nested fields are overwritten.
     * @returns {Promise<WriteResult>} A promise that resolves with the result of
     * the write. If the write fails, the promise is rejected with a
     * [BulkWriterError]{@link BulkWriterError}.
     *
     *
     * @example
     * ```
     * let bulkWriter = firestore.bulkWriter();
     * let documentRef = firestore.collection('col').doc();
     *
     * bulkWriter
     *  .set(documentRef, {foo: 'bar'})
     *  .then(result => {
     *    console.log('Successfully executed write at: ', result);
     *  })
     *  .catch(err => {
     *    console.log('Write failed with: ', err);
     *  });
     * });
     * ```
     */
    set(documentRef, data, options) {
        this._verifyNotClosed();
        return this._enqueue(documentRef, 'set', bulkCommitBatch => {
            if (options) {
                return bulkCommitBatch.set(documentRef, data, options);
            }
            else {
                return bulkCommitBatch.set(documentRef, data);
            }
        });
    }
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
    update(documentRef, dataOrField, ...preconditionOrValues) {
        this._verifyNotClosed();
        return this._enqueue(documentRef, 'update', bulkCommitBatch => bulkCommitBatch.update(documentRef, dataOrField, ...preconditionOrValues));
    }
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
    onWriteResult(successCallback) {
        this._successFn = successCallback;
    }
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
    onWriteError(shouldRetryCallback) {
        this._errorHandlerSet = true;
        this._errorFn = shouldRetryCallback;
    }
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
    flush() {
        this._verifyNotClosed();
        this._scheduleCurrentBatch(/* flush= */ true);
        // Mark the most recent operation as flushed to ensure that the batch
        // containing it will be sent once it's popped from the buffer.
        if (this._bufferedOperations.length > 0) {
            this._bufferedOperations[this._bufferedOperations.length - 1].operation.markFlushed();
        }
        return this._lastOp;
    }
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
    close() {
        if (!this._closePromise) {
            this._closePromise = this.flush();
            this.firestore._decrementBulkWritersCount();
        }
        return this._closePromise;
    }
    /**
     * Throws an error if the BulkWriter instance has been closed.
     * @private
     * @internal
     */
    _verifyNotClosed() {
        if (this._closePromise) {
            throw new Error('BulkWriter has already been closed.');
        }
    }
    /**
     * Sends the current batch and resets `this._bulkCommitBatch`.
     *
     * @param flush If provided, keeps re-sending operations until no more
     * operations are enqueued. This allows retries to resolve as part of a
     * `flush()` or `close()` call.
     * @private
     * @internal
     */
    _scheduleCurrentBatch(flush = false) {
        if (this._bulkCommitBatch._opCount === 0)
            return;
        const pendingBatch = this._bulkCommitBatch;
        this._bulkCommitBatch = new BulkCommitBatch(this.firestore, this._maxBatchSize);
        // Use the write with the longest backoff duration when determining backoff.
        const highestBackoffDuration = pendingBatch.pendingOps.reduce((prev, cur) => (prev.backoffDuration > cur.backoffDuration ? prev : cur)).backoffDuration;
        const backoffMsWithJitter = BulkWriter._applyJitter(highestBackoffDuration);
        const delayedExecution = new util_1.Deferred();
        if (backoffMsWithJitter > 0) {
            (0, backoff_1.delayExecution)(() => delayedExecution.resolve(), backoffMsWithJitter);
        }
        else {
            delayedExecution.resolve();
        }
        delayedExecution.promise.then(() => this._sendBatch(pendingBatch, flush));
    }
    /**
     * Sends the provided batch once the rate limiter does not require any delay.
     * @private
     * @internal
     */
    async _sendBatch(batch, flush = false) {
        const tag = (0, util_1.requestTag)();
        // Send the batch if it is does not require any delay, or schedule another
        // attempt after the appropriate timeout.
        const underRateLimit = this._rateLimiter.tryMakeRequest(batch._opCount);
        if (underRateLimit) {
            await batch.bulkCommit({ requestTag: tag });
            if (flush)
                this._scheduleCurrentBatch(flush);
        }
        else {
            const delayMs = this._rateLimiter.getNextRequestDelayMs(batch._opCount);
            (0, logger_1.logger)('BulkWriter._sendBatch', tag, `Backing off for ${delayMs} seconds`);
            (0, backoff_1.delayExecution)(() => this._sendBatch(batch, flush), delayMs);
        }
    }
    /**
     * Adds a 30% jitter to the provided backoff.
     *
     * @private
     * @internal
     */
    static _applyJitter(backoffMs) {
        if (backoffMs === 0)
            return 0;
        // Random value in [-0.3, 0.3].
        const jitter = exports.DEFAULT_JITTER_FACTOR * (Math.random() * 2 - 1);
        return Math.min(backoff_1.DEFAULT_BACKOFF_MAX_DELAY_MS, backoffMs + jitter * backoffMs);
    }
    /**
     * Schedules and runs the provided operation on the next available batch.
     * @private
     * @internal
     */
    _enqueue(ref, type, enqueueOnBatchCallback) {
        const bulkWriterOp = new BulkWriterOperation(ref, type, this._sendFn.bind(this, enqueueOnBatchCallback), this._errorFn.bind(this), this._successFn.bind(this));
        // Swallow the error if the developer has set an error listener. This
        // prevents UnhandledPromiseRejections from being thrown if a floating
        // BulkWriter operation promise fails when an error handler is specified.
        //
        // This is done here in order to chain the caught promise onto `lastOp`,
        // which ensures that flush() resolves after the operation promise.
        const userPromise = bulkWriterOp.promise.catch(err => {
            if (!this._errorHandlerSet) {
                throw err;
            }
            else {
                return bulkWriterOp.promise;
            }
        });
        // Advance the `_lastOp` pointer. This ensures that `_lastOp` only resolves
        // when both the previous and the current write resolve.
        this._lastOp = this._lastOp.then(() => (0, util_1.silencePromise)(userPromise));
        // Schedule the operation if the BulkWriter has fewer than the maximum
        // number of allowed pending operations, or add the operation to the
        // buffer.
        if (this._pendingOpsCount < this._maxPendingOpCount) {
            this._pendingOpsCount++;
            this._sendFn(enqueueOnBatchCallback, bulkWriterOp);
        }
        else {
            this._bufferedOperations.push(new BufferedOperation(bulkWriterOp, () => {
                this._pendingOpsCount++;
                this._sendFn(enqueueOnBatchCallback, bulkWriterOp);
            }));
        }
        // Chain the BulkWriter operation promise with the buffer processing logic
        // in order to ensure that it runs and that subsequent operations are
        // enqueued before the next batch is scheduled in `_sendBatch()`.
        return userPromise
            .then(res => {
            this._pendingOpsCount--;
            this._processBufferedOps();
            return res;
        })
            .catch(err => {
            this._pendingOpsCount--;
            this._processBufferedOps();
            throw err;
        });
    }
    /**
     * Manages the pending operation counter and schedules the next BulkWriter
     * operation if we're under the maximum limit.
     * @private
     * @internal
     */
    _processBufferedOps() {
        if (this._pendingOpsCount < this._maxPendingOpCount &&
            this._bufferedOperations.length > 0) {
            const nextOp = this._bufferedOperations.shift();
            nextOp.sendFn();
        }
    }
    /**
     * Schedules the provided operations on current BulkCommitBatch.
     * Sends the BulkCommitBatch if it reaches maximum capacity.
     *
     * @private
     * @internal
     */
    _sendFn(enqueueOnBatchCallback, op) {
        // A backoff duration greater than 0 implies that this batch is a retry.
        // Retried writes are sent with a batch size of 10 in order to guarantee
        // that the batch is under the 10MiB limit.
        if (op.backoffDuration > 0) {
            if (this._bulkCommitBatch.pendingOps.length >= exports.RETRY_MAX_BATCH_SIZE) {
                this._scheduleCurrentBatch(/* flush= */ false);
            }
            this._bulkCommitBatch.setMaxBatchSize(exports.RETRY_MAX_BATCH_SIZE);
        }
        if (this._bulkCommitBatch.has(op.ref)) {
            // Create a new batch since the backend doesn't support batches with two
            // writes to the same document.
            this._scheduleCurrentBatch();
        }
        enqueueOnBatchCallback(this._bulkCommitBatch);
        this._bulkCommitBatch.processLastOperation(op);
        if (this._bulkCommitBatch._opCount === this._bulkCommitBatch.maxBatchSize) {
            this._scheduleCurrentBatch();
        }
        else if (op.flushed) {
            // If flush() was called before this operation was enqueued into a batch,
            // we still need to schedule it.
            this._scheduleCurrentBatch(/* flush= */ true);
        }
    }
}
exports.BulkWriter = BulkWriter;
/**
 * Validates the use of 'value' as BulkWriterOptions.
 *
 * @private
 * @internal
 * @param value The BulkWriterOptions object to validate.
 * @throws if the input is not a valid BulkWriterOptions object.
 */
function validateBulkWriterOptions(value) {
    if ((0, validate_1.validateOptional)(value, { optional: true })) {
        return;
    }
    const argName = 'options';
    if (!(0, util_1.isObject)(value)) {
        throw new Error(`${(0, validate_1.invalidArgumentMessage)(argName, 'bulkWriter() options argument')} Input is not an object.`);
    }
    const options = value;
    if (options.throttling === undefined ||
        typeof options.throttling === 'boolean') {
        return;
    }
    if (options.throttling.initialOpsPerSecond !== undefined) {
        (0, validate_1.validateInteger)('initialOpsPerSecond', options.throttling.initialOpsPerSecond, {
            minValue: 1,
        });
    }
    if (options.throttling.maxOpsPerSecond !== undefined) {
        (0, validate_1.validateInteger)('maxOpsPerSecond', options.throttling.maxOpsPerSecond, {
            minValue: 1,
        });
        if (options.throttling.initialOpsPerSecond !== undefined &&
            options.throttling.initialOpsPerSecond >
                options.throttling.maxOpsPerSecond) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(argName, 'bulkWriter() options argument')} "maxOpsPerSecond" cannot be less than "initialOpsPerSecond".`);
        }
    }
}
//# sourceMappingURL=bulk-writer.js.map