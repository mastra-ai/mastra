/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
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
import { google } from '../protos/firestore_v1_proto_api';
import { Firestore } from './index';
import { FieldPath } from './path';
import { Timestamp } from './timestamp';
import { FirestoreUnaryMethod } from './types';
import { RequiredArgumentOptions } from './validate';
import api = google.firestore.v1;
/**
 * A WriteResult wraps the write time set by the Firestore servers on sets(),
 * updates(), and creates().
 *
 * @class WriteResult
 */
export declare class WriteResult implements firestore.WriteResult {
    private readonly _writeTime;
    /**
     * @private
     *
     * @param _writeTime The time of the corresponding document write.
     */
    constructor(_writeTime: Timestamp);
    /**
     * The write time as set by the Firestore servers.
     *
     * @type {Timestamp}
     * @name WriteResult#writeTime
     * @readonly
     *
     * @example
     * ```
     * let documentRef = firestore.doc('col/doc');
     *
     * documentRef.set({foo: 'bar'}).then(writeResult => {
     *   console.log(`Document written at: ${writeResult.writeTime.toDate()}`);
     * });
     * ```
     */
    get writeTime(): Timestamp;
    /**
     * Returns true if this `WriteResult` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return true if this `WriteResult` is equal to the provided value.
     */
    isEqual(other: firestore.WriteResult): boolean;
}
/**
 * A lazily-evaluated write that allows us to detect the Project ID before
 * serializing the request.
 * @private
 * @internal
 */
export type PendingWriteOp = () => api.IWrite;
/**
 * A Firestore WriteBatch that can be used to atomically commit multiple write
 * operations at once.
 *
 * @class WriteBatch
 */
export declare class WriteBatch implements firestore.WriteBatch {
    protected readonly _firestore: Firestore;
    private readonly _serializer;
    private readonly _allowUndefined;
    /**
     * An array of document paths and the corresponding write operations that are
     * executed as part of the commit. The resulting `api.IWrite` will be sent to
     * the backend.
     *
     * @private
     * @internal
     */
    private readonly _ops;
    private _committed;
    /**
     * The number of writes in this batch.
     * @private
     * @internal
     */
    get _opCount(): number;
    /** @private */
    constructor(firestore: Firestore);
    /**
     * Checks if this write batch has any pending operations.
     *
     * @private
     * @internal
     */
    get isEmpty(): boolean;
    /**
     * Throws an error if this batch has already been committed.
     *
     * @private
     * @internal
     */
    private verifyNotCommitted;
    /**
     * Create a document with the provided object values. This will fail the batch
     * if a document exists at its location.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * created.
     * @param {T} data The object to serialize as the document.
     * @throws {Error} If the provided input is not a valid Firestore document.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.collection('col').doc();
     *
     * writeBatch.create(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    create<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.WithFieldValue<AppModelType>): WriteBatch;
    /**
     * Deletes a document from the database.
     *
     * @param {DocumentReference} documentRef A reference to the document to be
     * deleted.
     * @param {Precondition=} precondition A precondition to enforce for this
     * delete.
     * @param {Timestamp=} precondition.lastUpdateTime If set, enforces that the
     * document was last updated at lastUpdateTime. Fails the batch if the
     * document doesn't exist or was last updated at a different time.
     * @param {boolean= } precondition.exists If set to true, enforces that the target
     * document must or must not exist.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.delete(documentRef);
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    delete(documentRef: firestore.DocumentReference<any, any>, precondition?: firestore.Precondition): WriteBatch;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.PartialWithFieldValue<AppModelType>, options: firestore.SetOptions): WriteBatch;
    set<AppModelType, DbModelType extends firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, data: firestore.WithFieldValue<AppModelType>): WriteBatch;
    /**
     * Update fields of the document referred to by the provided
     * [DocumentReference]{@link DocumentReference}. If the document
     * doesn't yet exist, the update fails and the entire batch will be rejected.
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
     * to restrict this update.
     * @throws {Error} If the provided input is not valid Firestore data.
     * @returns {WriteBatch} This WriteBatch instance. Used for chaining
     * method calls.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.update(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    update<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData>(documentRef: firestore.DocumentReference<AppModelType, DbModelType>, dataOrField: firestore.UpdateData<DbModelType> | string | firestore.FieldPath, ...preconditionOrValues: Array<{
        lastUpdateTime?: firestore.Timestamp;
    } | unknown | string | firestore.FieldPath>): WriteBatch;
    /**
     * Atomically commits all pending operations to the database and verifies all
     * preconditions. Fails the entire write if any precondition is not met.
     *
     * @returns {Promise.<Array.<WriteResult>>} A Promise that resolves
     * when this batch completes.
     *
     * @example
     * ```
     * let writeBatch = firestore.batch();
     * let documentRef = firestore.doc('col/doc');
     *
     * writeBatch.set(documentRef, {foo: 'bar'});
     *
     * writeBatch.commit().then(() => {
     *   console.log('Successfully executed batch.');
     * });
     * ```
     */
    commit(): Promise<WriteResult[]>;
    /**
     * Commit method that takes an optional transaction ID.
     *
     * @private
     * @internal
     * @param commitOptions Options to use for this commit.
     * @param commitOptions.transactionId The transaction ID of this commit.
     * @param commitOptions.requestTag A unique client-assigned identifier for
     * this request.
     * @returns  A Promise that resolves when this batch completes.
     */
    _commit<Req extends api.ICommitRequest, Resp>(commitOptions?: {
        transactionId?: Uint8Array;
        requestTag?: string;
        retryCodes?: number[];
        methodName?: FirestoreUnaryMethod;
    }): Promise<Resp>;
    /**
     * Resets the WriteBatch and dequeues all pending operations.
     * @private
     * @internal
     */
    _reset(): void;
}
/**
 * Validates the use of 'value' as SetOptions and enforces that 'merge' is a
 * boolean.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The object to validate.
 * @param options Optional validation options specifying whether the value can
 * be omitted.
 * @throws if the input is not a valid SetOptions object.
 */
export declare function validateSetOptions(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates a JavaScript object for usage as a Firestore document.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param obj JavaScript object to validate.
 * @param allowDeletes Whether to allow FieldValue.delete() sentinels.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 * @throws when the object is invalid.
 */
export declare function validateDocumentData(arg: string | number, obj: unknown, allowDeletes: boolean, allowUndefined: boolean): void;
/**
 * Validates that a value can be used as field value during an update.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param val The value to verify.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 * @param path The path to show in the error message.
 */
export declare function validateFieldValue(arg: string | number, val: unknown, allowUndefined: boolean, path?: FieldPath): void;
