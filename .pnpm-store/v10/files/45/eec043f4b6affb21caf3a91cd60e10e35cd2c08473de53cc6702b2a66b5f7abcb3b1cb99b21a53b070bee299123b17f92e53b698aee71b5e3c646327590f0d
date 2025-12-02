"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
exports.parseGetAllArguments = parseGetAllArguments;
const backoff_1 = require("./backoff");
const index_1 = require("./index");
const logger_1 = require("./logger");
const path_1 = require("./path");
const aggregate_query_1 = require("./reference/aggregate-query");
const document_reference_1 = require("./reference/document-reference");
const query_1 = require("./reference/query");
const helpers_1 = require("./reference/helpers");
const util_1 = require("./util");
const validate_1 = require("./validate");
const document_reader_1 = require("./document-reader");
const trace_util_1 = require("./telemetry/trace-util");
/*!
 * Error message for transactional reads that were executed after performing
 * writes.
 */
const READ_AFTER_WRITE_ERROR_MSG = 'Firestore transactions require all reads to be executed before all writes.';
const READ_ONLY_WRITE_ERROR_MSG = 'Firestore read-only transactions cannot execute writes.';
/**
 * A reference to a transaction.
 *
 * The Transaction object passed to a transaction's updateFunction provides
 * the methods to read and write data within the transaction context. See
 * [runTransaction()]{@link Firestore#runTransaction}.
 *
 * @class Transaction
 */
class Transaction {
    /**
     * @private
     *
     * @param firestore The Firestore Database client.
     * @param requestTag A unique client-assigned identifier for the scope of
     * this transaction.
     * @param transactionOptions The user-defined options for this transaction.
     */
    constructor(firestore, requestTag, transactionOptions) {
        this._maxAttempts = index_1.DEFAULT_MAX_TRANSACTION_ATTEMPTS;
        this._firestore = firestore;
        this._requestTag = requestTag;
        if (transactionOptions === null || transactionOptions === void 0 ? void 0 : transactionOptions.readOnly) {
            // Avoid initialising write batch and backoff unnecessarily for read-only transactions
            this._maxAttempts = 1;
            this._readOnlyReadTime = transactionOptions.readTime;
        }
        else {
            this._maxAttempts =
                (transactionOptions === null || transactionOptions === void 0 ? void 0 : transactionOptions.maxAttempts) || index_1.DEFAULT_MAX_TRANSACTION_ATTEMPTS;
            this._writeBatch = firestore.batch();
            this._backoff = new backoff_1.ExponentialBackoff();
        }
    }
    /**
     * Retrieve a document or a query result from the database. Holds a
     * pessimistic lock on all returned documents.
     *
     * @param {DocumentReference|Query} refOrQuery The document or query to
     * return.
     * @returns {Promise} A Promise that resolves with a DocumentSnapshot or
     * QuerySnapshot for the returned documents.
     *
     * @example
     * ```
     * firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   return transaction.get(documentRef).then(doc => {
     *     if (doc.exists) {
     *       transaction.update(documentRef, { count: doc.get('count') + 1 });
     *     } else {
     *       transaction.create(documentRef, { count: 1 });
     *     }
     *   });
     * });
     * ```
     */
    get(refOrQuery) {
        if (this._writeBatch && !this._writeBatch.isEmpty) {
            throw new Error(READ_AFTER_WRITE_ERROR_MSG);
        }
        if (refOrQuery instanceof document_reference_1.DocumentReference) {
            return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_TRANSACTION_GET_DOCUMENT, () => {
                return this.withLazyStartedTransaction(refOrQuery, this.getSingleFn);
            });
        }
        if (refOrQuery instanceof query_1.Query || refOrQuery instanceof aggregate_query_1.AggregateQuery) {
            return this._firestore._traceUtil.startActiveSpan(refOrQuery instanceof query_1.Query
                ? trace_util_1.SPAN_NAME_TRANSACTION_GET_QUERY
                : trace_util_1.SPAN_NAME_TRANSACTION_GET_AGGREGATION_QUERY, () => {
                return this.withLazyStartedTransaction(refOrQuery, this.getQueryFn);
            });
        }
        throw new Error('Value for argument "refOrQuery" must be a DocumentReference, Query, or AggregateQuery.');
    }
    /**
     * Retrieves multiple documents from Firestore. Holds a pessimistic lock on
     * all returned documents.
     *
     * The first argument is required and must be of type `DocumentReference`
     * followed by any additional `DocumentReference` documents. If used, the
     * optional `ReadOptions` must be the last argument.
     *
     * @param {...DocumentReference|ReadOptions} documentRefsOrReadOptions The
     * `DocumentReferences` to receive, followed by an optional field mask.
     * @returns {Promise<Array.<DocumentSnapshot>>} A Promise that
     * contains an array with the resulting document snapshots.
     *
     * @example
     * ```
     * let firstDoc = firestore.doc('col/doc1');
     * let secondDoc = firestore.doc('col/doc2');
     * let resultDoc = firestore.doc('col/doc3');
     *
     * firestore.runTransaction(transaction => {
     *   return transaction.getAll(firstDoc, secondDoc).then(docs => {
     *     transaction.set(resultDoc, {
     *       sum: docs[0].get('count') + docs[1].get('count')
     *     });
     *   });
     * });
     * ```
     */
    getAll(...documentRefsOrReadOptions) {
        if (this._writeBatch && !this._writeBatch.isEmpty) {
            throw new Error(READ_AFTER_WRITE_ERROR_MSG);
        }
        (0, validate_1.validateMinNumberOfArguments)('Transaction.getAll', documentRefsOrReadOptions, 1);
        return this.withLazyStartedTransaction(parseGetAllArguments(documentRefsOrReadOptions), this.getBatchFn);
    }
    /**
     * Create the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. The operation will
     * fail the transaction if a document exists at the specified location.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * created.
     * @param {DocumentData} data The object data to serialize as the document.
     * @returns {Transaction} This Transaction instance. Used for
     * chaining method calls.
     *
     * @example
     * ```
     * firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   return transaction.get(documentRef).then(doc => {
     *     if (!doc.exists) {
     *       transaction.create(documentRef, { foo: 'bar' });
     *     }
     *   });
     * });
     * ```
     */
    create(documentRef, data) {
        if (!this._writeBatch) {
            throw new Error(READ_ONLY_WRITE_ERROR_MSG);
        }
        this._writeBatch.create(documentRef, data);
        return this;
    }
    /**
     * Writes to the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document
     * does not exist yet, it will be created. If you pass
     * [SetOptions]{@link SetOptions}, the provided data can be merged into the
     * existing document.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * set.
     * @param {T|Partial<T>} data The object to serialize as the document.
     * @param {SetOptions=} options An object to configure the set behavior.
     * @param {boolean=} options.merge - If true, set() merges the values
     * specified in its data argument. Fields omitted from this set() call remain
     * untouched. If your input sets any field to an empty map, all nested fields
     * are overwritten.
     * @param {Array.<string|FieldPath>=} options.mergeFields - If provided,
     * set() only replaces the specified field paths. Any field path that is not
     * specified is ignored and remains untouched. If your input sets any field to
     * an empty map, all nested fields are overwritten.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {Transaction} This Transaction instance. Used for
     * chaining method calls.
     *
     * @example
     * ```
     * firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   transaction.set(documentRef, { foo: 'bar' });
     *   return Promise.resolve();
     * });
     * ```
     */
    set(documentRef, data, options) {
        if (!this._writeBatch) {
            throw new Error(READ_ONLY_WRITE_ERROR_MSG);
        }
        if (options) {
            this._writeBatch.set(documentRef, data, options);
        }
        else {
            this._writeBatch.set(documentRef, data);
        }
        return this;
    }
    /**
     * Updates fields in the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. The update will
     * fail if applied to a document that does not exist.
     *
     * The update() method accepts either an object with field paths encoded as
     * keys and field values encoded as values, or a variable number of arguments
     * that alternate between field paths and field values. Nested fields can be
     * updated by providing dot-separated field path strings or by providing
     * FieldPath objects.
     *
     * A Precondition restricting this update can be specified as the last
     * argument.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * updated.
     * @param {UpdateData|string|FieldPath} dataOrField An object
     * containing the fields and values with which to update the document
     * or the path of the first field to update.
     * @param {
     * ...(Precondition|*|string|FieldPath)} preconditionOrValues -
     * An alternating list of field paths and values to update or a Precondition
     * to to enforce on this update.
     * @throws {Error} If the provided input is not valid Firestore data.
     * @returns {Transaction} This Transaction instance. Used for
     * chaining method calls.
     *
     * @example
     * ```
     * firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   return transaction.get(documentRef).then(doc => {
     *     if (doc.exists) {
     *       transaction.update(documentRef, { count: doc.get('count') + 1 });
     *     } else {
     *       transaction.create(documentRef, { count: 1 });
     *     }
     *   });
     * });
     * ```
     */
    update(documentRef, dataOrField, ...preconditionOrValues) {
        if (!this._writeBatch) {
            throw new Error(READ_ONLY_WRITE_ERROR_MSG);
        }
        // eslint-disable-next-line prefer-rest-params
        (0, validate_1.validateMinNumberOfArguments)('Transaction.update', arguments, 2);
        this._writeBatch.update(documentRef, dataOrField, ...preconditionOrValues);
        return this;
    }
    /**
     * Deletes the document referred to by the provided [DocumentReference]
     * {@link DocumentReference}.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * deleted.
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the transaction if the
     * document doesn't exist or was last updated at a different time.
     * @param {boolean=} precondition.exists If set, enforces that the target
     * document must or must not exist.
     * @returns {Transaction} This Transaction instance. Used for
     * chaining method calls.
     *
     * @example
     * ```
     * firestore.runTransaction(transaction => {
     *   let documentRef = firestore.doc('col/doc');
     *   transaction.delete(documentRef);
     *   return Promise.resolve();
     * });
     * ```
     */
    delete(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentRef, precondition) {
        if (!this._writeBatch) {
            throw new Error(READ_ONLY_WRITE_ERROR_MSG);
        }
        this._writeBatch.delete(documentRef, precondition);
        return this;
    }
    /**
     * Commits all queued-up changes in this transaction and releases all locks.
     *
     * @private
     * @internal
     */
    async commit() {
        var _a;
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_TRANSACTION_COMMIT, async () => {
            if (!this._writeBatch) {
                throw new Error(READ_ONLY_WRITE_ERROR_MSG);
            }
            // If we have not performed any reads in this particular attempt
            // then the writes will be atomically committed without a transaction ID
            let transactionId;
            if (this._transactionIdPromise) {
                transactionId = await this._transactionIdPromise;
            }
            else if (this._writeBatch.isEmpty) {
                // If we have not started a transaction (no reads) and we have no writes
                // then the commit is a no-op (success)
                return;
            }
            await this._writeBatch._commit({
                transactionId,
                requestTag: this._requestTag,
            });
            this._transactionIdPromise = undefined;
            this._prevTransactionId = transactionId;
        }, {
            [trace_util_1.ATTRIBUTE_KEY_IS_TRANSACTIONAL]: true,
            [trace_util_1.ATTRIBUTE_KEY_DOC_COUNT]: (_a = this._writeBatch) === null || _a === void 0 ? void 0 : _a._opCount,
        });
    }
    /**
     * Releases all locks and rolls back this transaction. The rollback process
     * is completed asynchronously and this function resolves before the operation
     * is completed.
     *
     * @private
     * @internal
     */
    async rollback() {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_TRANSACTION_ROLLBACK, async () => {
            // No need to roll back if we have not lazily started the transaction
            // or if we are read only
            if (!this._transactionIdPromise || !this._writeBatch) {
                return;
            }
            let transactionId;
            try {
                transactionId = await this._transactionIdPromise;
            }
            catch (_a) {
                // This means the initial read operation rejected
                // and we do not have a transaction ID to roll back
                this._transactionIdPromise = undefined;
                return;
            }
            const request = {
                database: this._firestore.formattedName,
                transaction: transactionId,
            };
            this._transactionIdPromise = undefined;
            this._prevTransactionId = transactionId;
            // We don't need to wait for rollback to completed before continuing.
            // If there are any locks held, then rollback will eventually release them.
            // Rollback can be done concurrently thereby reducing latency caused by
            // otherwise blocking.
            this._firestore
                .request('rollback', request, this._requestTag)
                .catch(err => {
                (0, logger_1.logger)('Firestore.runTransaction', this._requestTag, 'Best effort to rollback failed with error:', err);
            });
        });
    }
    /**
     * Executes `updateFunction()` and commits the transaction with retry.
     *
     * @private
     * @internal
     * @param updateFunction The user function to execute within the transaction
     * context.
     */
    async runTransaction(updateFunction) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_TRANSACTION_RUN, async (span) => {
            // No backoff is set for readonly transactions (i.e. attempts == 1)
            if (!this._writeBatch) {
                return this.runTransactionOnce(updateFunction);
            }
            let lastError = undefined;
            for (let attempt = 0; attempt < this._maxAttempts; ++attempt) {
                span.setAttributes({
                    [trace_util_1.ATTRIBUTE_KEY_TRANSACTION_TYPE]: this._writeBatch
                        ? 'READ_WRITE'
                        : 'READ_ONLY',
                    [trace_util_1.ATTRIBUTE_KEY_ATTEMPTS_ALLOWED]: this._maxAttempts,
                    [trace_util_1.ATTRIBUTE_KEY_ATTEMPTS_REMAINING]: this._maxAttempts - attempt - 1,
                });
                try {
                    if (lastError) {
                        (0, logger_1.logger)('Firestore.runTransaction', this._requestTag, 'Retrying transaction after error:', lastError);
                        span.addEvent('Initiate transaction retry');
                    }
                    this._writeBatch._reset();
                    await maybeBackoff(this._backoff, lastError);
                    return await this.runTransactionOnce(updateFunction);
                }
                catch (err) {
                    lastError = err;
                    if (!isRetryableTransactionError(err)) {
                        break;
                    }
                }
            }
            (0, logger_1.logger)('Firestore.runTransaction', this._requestTag, 'Transaction not eligible for retry, returning error: %s', lastError);
            return Promise.reject(lastError);
        });
    }
    /**
     * Make single attempt to execute `updateFunction()` and commit the
     * transaction. Will rollback upon error.
     *
     * @private
     * @internal
     * @param updateFunction The user function to execute within the transaction
     * context.
     */
    async runTransactionOnce(updateFunction) {
        try {
            const promise = updateFunction(this);
            if (!(promise instanceof Promise)) {
                throw new Error('You must return a Promise in your transaction()-callback.');
            }
            const result = await promise;
            if (this._writeBatch) {
                await this.commit();
            }
            return result;
        }
        catch (err) {
            (0, logger_1.logger)('Firestore.runTransaction', this._requestTag, 'Rolling back transaction after callback error:', err);
            await this.rollback();
            return Promise.reject(err);
        }
    }
    /**
     * Given a function that performs a read operation, ensures that the first one
     * is provided with new transaction options and all subsequent ones are queued
     * upon the resulting transaction ID.
     */
    withLazyStartedTransaction(param, resultFn) {
        if (this._transactionIdPromise) {
            // Simply queue this subsequent read operation after the first read
            // operation has resolved and we don't expect a transaction ID in the
            // response because we are not starting a new transaction
            return this._transactionIdPromise
                .then(opts => resultFn.call(this, param, opts))
                .then(r => r.result);
        }
        else {
            if (this._readOnlyReadTime) {
                // We do not start a transaction for read-only transactions
                // do not set _prevTransactionId
                return resultFn
                    .call(this, param, this._readOnlyReadTime)
                    .then(r => r.result);
            }
            else {
                // This is the first read of the transaction so we create the appropriate
                // options for lazily starting the transaction inside this first read op
                const opts = {};
                if (this._writeBatch) {
                    opts.readWrite = this._prevTransactionId
                        ? { retryTransaction: this._prevTransactionId }
                        : {};
                }
                else {
                    opts.readOnly = {};
                }
                const resultPromise = resultFn.call(this, param, opts);
                // Ensure the _transactionIdPromise is set synchronously so that
                // subsequent operations will not race to start another transaction
                this._transactionIdPromise = resultPromise.then(r => {
                    if (!r.transaction) {
                        // Illegal state
                        // The read operation was provided with new transaction options but did not return a transaction ID
                        // Rejecting here will cause all queued reads to reject
                        throw new Error('Transaction ID was missing from server response');
                    }
                    return r.transaction;
                });
                return resultPromise.then(r => r.result);
            }
        }
    }
    async getSingleFn(document, opts) {
        const documentReader = new document_reader_1.DocumentReader(this._firestore, [document], undefined, opts);
        const { transaction, result: [result], } = await documentReader._get(this._requestTag);
        return { transaction, result };
    }
    async getBatchFn({ documents, fieldMask, }, opts) {
        return this._firestore._traceUtil.startActiveSpan(trace_util_1.SPAN_NAME_TRANSACTION_GET_DOCUMENTS, async () => {
            const documentReader = new document_reader_1.DocumentReader(this._firestore, documents, fieldMask, opts);
            return documentReader._get(this._requestTag);
        });
    }
    async getQueryFn(query, opts) {
        return query._get(opts);
    }
}
exports.Transaction = Transaction;
/**
 * Parses the arguments for the `getAll()` call supported by both the Firestore
 * and Transaction class.
 *
 * @private
 * @internal
 * @param documentRefsOrReadOptions An array of document references followed by
 * an optional ReadOptions object.
 */
function parseGetAllArguments(documentRefsOrReadOptions) {
    let documents;
    let readOptions = undefined;
    if (Array.isArray(documentRefsOrReadOptions[0])) {
        throw new Error('getAll() no longer accepts an array as its first argument. ' +
            'Please unpack your array and call getAll() with individual arguments.');
    }
    if (documentRefsOrReadOptions.length > 0 &&
        (0, util_1.isPlainObject)(documentRefsOrReadOptions[documentRefsOrReadOptions.length - 1])) {
        readOptions = documentRefsOrReadOptions.pop();
        documents = documentRefsOrReadOptions;
    }
    else {
        documents = documentRefsOrReadOptions;
    }
    for (let i = 0; i < documents.length; ++i) {
        (0, helpers_1.validateDocumentReference)(i, documents[i]);
    }
    validateReadOptions('options', readOptions, { optional: true });
    const fieldMask = readOptions && readOptions.fieldMask
        ? readOptions.fieldMask.map(fieldPath => path_1.FieldPath.fromArgument(fieldPath))
        : undefined;
    return { fieldMask, documents };
}
/**
 * Validates the use of 'options' as ReadOptions and enforces that 'fieldMask'
 * is an array of strings or field paths.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the ReadOptions can be omitted.
 */
function validateReadOptions(arg, value, options) {
    if (!(0, validate_1.validateOptional)(value, options)) {
        if (!(0, util_1.isObject)(value)) {
            throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'read option')} Input is not an object.'`);
        }
        const options = value;
        if (options.fieldMask !== undefined) {
            if (!Array.isArray(options.fieldMask)) {
                throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'read option')} "fieldMask" is not an array.`);
            }
            for (let i = 0; i < options.fieldMask.length; ++i) {
                try {
                    (0, path_1.validateFieldPath)(i, options.fieldMask[i]);
                }
                catch (err) {
                    throw new Error(`${(0, validate_1.invalidArgumentMessage)(arg, 'read option')} "fieldMask" is not valid: ${err.message}`);
                }
            }
        }
    }
}
function isRetryableTransactionError(error) {
    if (error.code !== undefined) {
        // This list is based on https://github.com/firebase/firebase-js-sdk/blob/master/packages/firestore/src/core/transaction_runner.ts#L112
        switch (error.code) {
            case 10 /* StatusCode.ABORTED */:
            case 1 /* StatusCode.CANCELLED */:
            case 2 /* StatusCode.UNKNOWN */:
            case 4 /* StatusCode.DEADLINE_EXCEEDED */:
            case 13 /* StatusCode.INTERNAL */:
            case 14 /* StatusCode.UNAVAILABLE */:
            case 16 /* StatusCode.UNAUTHENTICATED */:
            case 8 /* StatusCode.RESOURCE_EXHAUSTED */:
                return true;
            case 3 /* StatusCode.INVALID_ARGUMENT */:
                // The Firestore backend uses "INVALID_ARGUMENT" for transactions
                // IDs that have expired. While INVALID_ARGUMENT is generally not
                // retryable, we retry this specific case.
                return !!error.message.match(/transaction has expired/);
            default:
                return false;
        }
    }
    return false;
}
/**
 * Delays further operations based on the provided error.
 *
 * @private
 * @internal
 * @return A Promise that resolves after the delay expired.
 */
async function maybeBackoff(backoff, error) {
    if ((error === null || error === void 0 ? void 0 : error.code) === 8 /* StatusCode.RESOURCE_EXHAUSTED */) {
        backoff.resetToMax();
    }
    await backoff.backoffAndWait();
}
//# sourceMappingURL=transaction.js.map