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
import * as firestore from '@google-cloud/firestore';
import { DocumentSnapshot } from './document';
import { Firestore } from './index';
import { FieldPath } from './path';
import { AggregateQuerySnapshot } from './reference/aggregate-query-snapshot';
import { DocumentReference } from './reference/document-reference';
import { QuerySnapshot } from './reference/query-snapshot';
/**
 * A reference to a transaction.
 *
 * The Transaction object passed to a transaction's updateFunction provides
 * the methods to read and write data within the transaction context. See
 * [runTransaction()]{@link Firestore#runTransaction}.
 *
 * @class Transaction
 */
export declare class Transaction implements firestore.Transaction {
    private readonly _firestore;
    private readonly _maxAttempts;
    private readonly _requestTag;
    /** Optional, could be set only if transaction is read only */
    private readonly _readOnlyReadTime;
    /** `undefined` if transaction is read only */
    private readonly _writeBatch;
    /** `undefined` if transaction is read only */
    private readonly _backoff;
    /**
     * Promise that resolves to the transaction ID of the current attempt.
     * It is lazily initialised upon the first read. Upon retry, it is reset and
     * `_prevTransactionId` is set
     */
    private _transactionIdPromise?;
    private _prevTransactionId?;
    /**
     * @private
     *
     * @param firestore The Firestore Database client.
     * @param requestTag A unique client-assigned identifier for the scope of
     * this transaction.
     * @param transactionOptions The user-defined options for this transaction.
     */
    constructor(firestore: Firestore, requestTag: string, transactionOptions?: firestore.ReadWriteTransactionOptions | firestore.ReadOnlyTransactionOptions);
    /**
     * Retrieves a query result. Holds a pessimistic lock on all returned
     * documents.
     *
     * @param {Query} query A query to execute.
     * @return {Promise<QuerySnapshot>} A QuerySnapshot for the retrieved data.
     */
    get<AppModelType, DbModelType extends firestore.DocumentData>(query: firestore.Query<AppModelType, DbModelType>): Promise<QuerySnapshot<AppModelType, DbModelType>>;
    /**
     * Reads the document referenced by the provided `DocumentReference.`
     * Holds a pessimistic lock on the returned document.
     *
     * @param {DocumentReference} documentRef A reference to the document to be read.
     * @return {Promise<DocumentSnapshot>}  A DocumentSnapshot for the read data.
     */
    get<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>): Promise<DocumentSnapshot<AppModelType, DbModelType>>;
    /**
     * Retrieves an aggregate query result. Holds a pessimistic lock on all
     * documents that were matched by the underlying query.
     *
     * @param aggregateQuery An aggregate query to execute.
     * @return An AggregateQuerySnapshot for the retrieved data.
     */
    get<AppModelType, DbModelType extends firestore.DocumentData, AggregateSpecType extends firestore.AggregateSpec>(aggregateQuery: firestore.AggregateQuery<AggregateSpecType, AppModelType, DbModelType>): Promise<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>;
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
    getAll<AppModelType, DbModelType extends firestore.DocumentData>(...documentRefsOrReadOptions: Array<firestore.DocumentReference<AppModelType, DbModelType> | firestore.ReadOptions>): Promise<Array<DocumentSnapshot<AppModelType, DbModelType>>>;
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
    create<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.WithFieldValue<AppModelType>): Transaction;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.PartialWithFieldValue<AppModelType>, options: firestore.SetOptions): Transaction;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.WithFieldValue<AppModelType>): Transaction;
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
    update<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, dataOrField: firestore.UpdateData<DbModelType> | string | firestore.FieldPath, ...preconditionOrValues: Array<firestore.Precondition | unknown | string | firestore.FieldPath>): Transaction;
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
    delete(documentRef: DocumentReference<any, any>, precondition?: firestore.Precondition): this;
    /**
     * Commits all queued-up changes in this transaction and releases all locks.
     *
     * @private
     * @internal
     */
    commit(): Promise<void>;
    /**
     * Releases all locks and rolls back this transaction. The rollback process
     * is completed asynchronously and this function resolves before the operation
     * is completed.
     *
     * @private
     * @internal
     */
    rollback(): Promise<void>;
    /**
     * Executes `updateFunction()` and commits the transaction with retry.
     *
     * @private
     * @internal
     * @param updateFunction The user function to execute within the transaction
     * context.
     */
    runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>;
    /**
     * Make single attempt to execute `updateFunction()` and commit the
     * transaction. Will rollback upon error.
     *
     * @private
     * @internal
     * @param updateFunction The user function to execute within the transaction
     * context.
     */
    runTransactionOnce<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>;
    /**
     * Given a function that performs a read operation, ensures that the first one
     * is provided with new transaction options and all subsequent ones are queued
     * upon the resulting transaction ID.
     */
    private withLazyStartedTransaction;
    private getSingleFn;
    private getBatchFn;
    private getQueryFn;
}
/**
 * Parses the arguments for the `getAll()` call supported by both the Firestore
 * and Transaction class.
 *
 * @private
 * @internal
 * @param documentRefsOrReadOptions An array of document references followed by
 * an optional ReadOptions object.
 */
export declare function parseGetAllArguments<AppModelType, DbModelType extends firestore.DocumentData>(documentRefsOrReadOptions: Array<firestore.DocumentReference<AppModelType, DbModelType> | firestore.ReadOptions>): {
    documents: Array<DocumentReference<AppModelType, DbModelType>>;
    fieldMask: FieldPath[] | undefined;
};
