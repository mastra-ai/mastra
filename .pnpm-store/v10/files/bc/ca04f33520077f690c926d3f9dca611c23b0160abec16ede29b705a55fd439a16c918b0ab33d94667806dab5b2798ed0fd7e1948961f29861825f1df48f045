/**
 * Copyright 2024 Google LLC. All Rights Reserved.
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
import { QueryDocumentSnapshot } from '../document';
import { DocumentChange } from '../document-change';
import { Timestamp } from '../timestamp';
import { Query } from './query';
/**
 * A QuerySnapshot contains zero or more
 * [QueryDocumentSnapshot]{@link QueryDocumentSnapshot} objects
 * representing the results of a query. The documents can be accessed as an
 * array via the [documents]{@link QuerySnapshot#documents} property
 * or enumerated using the [forEach]{@link QuerySnapshot#forEach}
 * method. The number of documents can be determined via the
 * [empty]{@link QuerySnapshot#empty} and
 * [size]{@link QuerySnapshot#size} properties.
 *
 * @class QuerySnapshot
 */
export declare class QuerySnapshot<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.QuerySnapshot<AppModelType, DbModelType> {
    private readonly _query;
    private readonly _readTime;
    private readonly _size;
    private _materializedDocs;
    private _materializedChanges;
    private _docs;
    private _changes;
    /**
     * @private
     *
     * @param _query The originating query.
     * @param _readTime The time when this query snapshot was obtained.
     * @param _size The number of documents in the result set.
     * @param docs A callback returning a sorted array of documents matching
     * this query
     * @param changes A callback returning a sorted array of document change
     * events for this snapshot.
     */
    constructor(_query: Query<AppModelType, DbModelType>, _readTime: Timestamp, _size: number, docs: () => Array<QueryDocumentSnapshot<AppModelType, DbModelType>>, changes: () => Array<DocumentChange<AppModelType, DbModelType>>);
    /**
     * The query on which you called get() or onSnapshot() in order to get this
     * QuerySnapshot.
     *
     * @type {Query}
     * @name QuerySnapshot#query
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.limit(10).get().then(querySnapshot => {
     *   console.log(`Returned first batch of results`);
     *   let query = querySnapshot.query;
     *   return query.offset(10).get();
     * }).then(() => {
     *   console.log(`Returned second batch of results`);
     * });
     * ```
     */
    get query(): Query<AppModelType, DbModelType>;
    /**
     * An array of all the documents in this QuerySnapshot.
     *
     * @type {Array.<QueryDocumentSnapshot>}
     * @name QuerySnapshot#docs
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   let docs = querySnapshot.docs;
     *   for (let doc of docs) {
     *     console.log(`Document found at path: ${doc.ref.path}`);
     *   }
     * });
     * ```
     */
    get docs(): Array<QueryDocumentSnapshot<AppModelType, DbModelType>>;
    /**
     * True if there are no documents in the QuerySnapshot.
     *
     * @type {boolean}
     * @name QuerySnapshot#empty
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   if (querySnapshot.empty) {
     *     console.log('No documents found.');
     *   }
     * });
     * ```
     */
    get empty(): boolean;
    /**
     * The number of documents in the QuerySnapshot.
     *
     * @type {number}
     * @name QuerySnapshot#size
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   console.log(`Found ${querySnapshot.size} documents.`);
     * });
     * ```
     */
    get size(): number;
    /**
     * The time this query snapshot was obtained.
     *
     * @type {Timestamp}
     * @name QuerySnapshot#readTime
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then((querySnapshot) => {
     *   let readTime = querySnapshot.readTime;
     *   console.log(`Query results returned at '${readTime.toDate()}'`);
     * });
     * ```
     */
    get readTime(): Timestamp;
    /**
     * Returns an array of the documents changes since the last snapshot. If
     * this is the first snapshot, all documents will be in the list as added
     * changes.
     *
     * @return {Array.<DocumentChange>}
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.onSnapshot(querySnapshot => {
     *   let changes = querySnapshot.docChanges();
     *   for (let change of changes) {
     *     console.log(`A document was ${change.type}.`);
     *   }
     * });
     * ```
     */
    docChanges(): Array<DocumentChange<AppModelType, DbModelType>>;
    /**
     * Enumerates all of the documents in the QuerySnapshot. This is a convenience
     * method for running the same callback on each {@link QueryDocumentSnapshot}
     * that is returned.
     *
     * @param {function} callback A callback to be called with a
     * [QueryDocumentSnapshot]{@link QueryDocumentSnapshot} for each document in
     * the snapshot.
     * @param {*=} thisArg The `this` binding for the callback..
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Document found at path: ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    forEach(callback: (result: firestore.QueryDocumentSnapshot<AppModelType, DbModelType>) => void, thisArg?: unknown): void;
    /**
     * Returns true if the document data in this `QuerySnapshot` is equal to the
     * provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `QuerySnapshot` is equal to the provided
     * value.
     */
    isEqual(other: firestore.QuerySnapshot<AppModelType, DbModelType>): boolean;
}
