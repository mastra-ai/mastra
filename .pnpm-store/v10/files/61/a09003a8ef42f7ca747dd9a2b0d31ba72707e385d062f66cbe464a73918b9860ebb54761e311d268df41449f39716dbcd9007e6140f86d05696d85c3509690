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
import { VectorQuery } from './vector-query';
/**
 * A `VectorQuerySnapshot` contains zero or more `QueryDocumentSnapshot` objects
 * representing the results of a query. The documents can be accessed as an
 * array via the `docs` property or enumerated using the `forEach` method. The
 * number of documents can be determined via the `empty` and `size`
 * properties.
 */
export declare class VectorQuerySnapshot<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.VectorQuerySnapshot<AppModelType, DbModelType> {
    private readonly _query;
    private readonly _readTime;
    private readonly _size;
    private _materializedDocs;
    private _materializedChanges;
    private _docs;
    private _changes;
    /**
     * @private
     * @internal
     *
     * @param _query - The originating query.
     * @param _readTime - The time when this query snapshot was obtained.
     * @param _size - The number of documents in the result set.
     * @param docs - A callback returning a sorted array of documents matching
     * this query
     * @param changes - A callback returning a sorted array of document change
     * events for this snapshot.
     */
    constructor(_query: VectorQuery<AppModelType, DbModelType>, _readTime: Timestamp, _size: number, docs: () => Array<QueryDocumentSnapshot<AppModelType, DbModelType>>, changes: () => Array<DocumentChange<AppModelType, DbModelType>>);
    /**
     * The `VectorQuery` on which you called get() in order to get this
     * `VectorQuerySnapshot`.
     *
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"})
     *   .get().then(querySnapshot => {
     *     console.log(`Returned first batch of results`);
     *     let query = querySnapshot.query;
     *     return query.offset(10).get();
     *   }).then(() => {
     *   console.log(`Returned second batch of results`);
     *   });
     * ```
     */
    get query(): VectorQuery<AppModelType, DbModelType>;
    /**
     * An array of all the documents in this `VectorQuerySnapshot`.
     *
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
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
     * `true` if there are no documents in the `VectorQuerySnapshot`.
     *
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
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
     * The number of documents in the `VectorQuerySnapshot`.
     *
     * @readonly
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
     *
     * query.get().then(querySnapshot => {
     *   console.log(`Found ${querySnapshot.size} documents.`);
     * });
     * ```
     */
    get size(): number;
    /**
     * The time this `VectorQuerySnapshot` was obtained.
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
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
     * @returns An array of the documents changes since the last snapshot.
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
     *
     * query.get().then(querySnapshot => {
     *   let changes = querySnapshot.docChanges();
     *   for (let change of changes) {
     *     console.log(`A document was ${change.type}.`);
     *   }
     * });
     * ```
     */
    docChanges(): Array<DocumentChange<AppModelType, DbModelType>>;
    /**
     * Enumerates all of the documents in the `VectorQuerySnapshot`. This is a convenience
     * method for running the same callback on each {@link QueryDocumentSnapshot}
     * that is returned.
     *
     * @param callback - A callback to be called with a
     * {@link QueryDocumentSnapshot} for each document in
     * the snapshot.
     * @param thisArg - The `this` binding for the callback..
     *
     * @example
     * ```
     * let query = firestore.collection('col')
     *   .findNearest("embedding", [0, 0], {limit: 10, distanceMeasure: "EUCLIDEAN"});
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
     * Returns true if the document data in this `VectorQuerySnapshot` is equal to the
     * provided value.
     *
     * @param other - The value to compare against.
     * @returns true if this `VectorQuerySnapshot` is equal to the provided
     * value.
     */
    isEqual(other: firestore.VectorQuerySnapshot<AppModelType, DbModelType>): boolean;
}
