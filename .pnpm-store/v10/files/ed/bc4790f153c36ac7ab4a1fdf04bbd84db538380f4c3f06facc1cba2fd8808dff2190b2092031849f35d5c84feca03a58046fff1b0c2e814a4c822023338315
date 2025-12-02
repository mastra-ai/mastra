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
import * as protos from '../../protos/firestore_v1_proto_api';
import api = protos.google.firestore.v1;
import * as firestore from '@google-cloud/firestore';
import { GoogleError } from 'google-gax';
import { QueryUtil } from './query-util';
import { Firestore, DocumentChange, DocumentSnapshot, FieldPath, Filter, QueryDocumentSnapshot, Timestamp } from '../index';
import { QueryOptions } from './query-options';
import { FieldOrder } from './field-order';
import { FilterInternal } from './filter-internal';
import { FieldFilterInternal } from './field-filter-internal';
import { VectorQueryOptions } from './vector-query-options';
import { QuerySnapshot } from './query-snapshot';
import { Serializer } from '../serializer';
import { ExplainResults } from '../query-profile';
import { CompositeFilter, UnaryFilter } from '../filter';
import { QueryResponse, QuerySnapshotResponse } from './types';
import { AggregateQuery } from './aggregate-query';
import { VectorQuery } from './vector-query';
/**
 * A Query refers to a query which you can read or stream from. You can also
 * construct refined Query objects by adding filters and ordering.
 *
 * @class Query
 */
export declare class Query<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.Query<AppModelType, DbModelType> {
    /**
     * @internal
     * @private
     **/
    readonly _firestore: Firestore;
    /**
     * @internal
     * @private
     **/
    readonly _queryOptions: QueryOptions<AppModelType, DbModelType>;
    /**
     * @internal
     * @private
     **/
    readonly _serializer: Serializer;
    /**
     * @internal
     * @private
     **/
    protected readonly _allowUndefined: boolean;
    /**
     * @internal
     * @private
     **/
    readonly _queryUtil: QueryUtil<AppModelType, DbModelType, Query<AppModelType, DbModelType>>;
    /**
     * @internal
     * @private
     *
     * @param _firestore The Firestore Database client.
     * @param _queryOptions Options that define the query.
     */
    constructor(
    /**
     * @internal
     * @private
     **/
    _firestore: Firestore, 
    /**
     * @internal
     * @private
     **/
    _queryOptions: QueryOptions<AppModelType, DbModelType>);
    /**
     * Extracts field values from the DocumentSnapshot based on the provided
     * field order.
     *
     * @private
     * @internal
     * @param documentSnapshot The document to extract the fields from.
     * @param fieldOrders The field order that defines what fields we should
     * extract.
     * @return {Array.<*>} The field values to use.
     */
    static _extractFieldValues(documentSnapshot: DocumentSnapshot, fieldOrders: FieldOrder[]): unknown[];
    /**
     * The [Firestore]{@link Firestore} instance for the Firestore
     * database (useful for performing transactions, etc.).
     *
     * @type {Firestore}
     * @name Query#firestore
     * @readonly
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.add({foo: 'bar'}).then(documentReference => {
     *   let firestore = documentReference.firestore;
     *   console.log(`Root location for document is ${firestore.formattedName}`);
     * });
     * ```
     */
    get firestore(): Firestore;
    /**
     * Creates and returns a new [Query]{@link Query} with the additional filter
     * that documents must contain the specified field and that its value should
     * satisfy the relation constraint provided.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the filter.
     *
     * @param {string|FieldPath} fieldPath The name of a property value to compare.
     * @param {string} opStr A comparison operation in the form of a string.
     * Acceptable operator strings are "<", "<=", "==", "!=", ">=", ">", "array-contains",
     * "in", "not-in", and "array-contains-any".
     * @param {*} value The value to which to compare the field for inclusion in
     * a query.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.where('foo', '==', 'bar').get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    where(fieldPath: string | FieldPath, opStr: firestore.WhereFilterOp, value: unknown): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} with the additional filter
     * that documents should satisfy the relation constraint(s) provided.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the filter.
     *
     * @param {Filter} filter A unary or composite filter to apply to the Query.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     *
     * collectionRef.where(Filter.and(Filter.where('foo', '==', 'bar'), Filter.where('foo', '!=', 'baz'))).get()
     *   .then(querySnapshot => {
     *     querySnapshot.forEach(documentSnapshot => {
     *       console.log(`Found document at ${documentSnapshot.ref.path}`);
     *     });
     * });
     * ```
     */
    where(filter: Filter): Query<AppModelType, DbModelType>;
    /**
     * @internal
     * @private
     */
    _parseFilter(filter: Filter): FilterInternal;
    /**
     * @internal
     * @private
     */
    _parseFieldFilter(fieldFilterData: UnaryFilter): FieldFilterInternal;
    /**
     * @internal
     * @private
     */
    _parseCompositeFilter(compositeFilterData: CompositeFilter): FilterInternal;
    /**
     * Creates and returns a new [Query]{@link Query} instance that applies a
     * field mask to the result and returns only the specified subset of fields.
     * You can specify a list of field paths to return, or use an empty list to
     * only return the references of matching documents.
     *
     * Queries that contain field masks cannot be listened to via `onSnapshot()`
     * listeners.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {...(string|FieldPath)} fieldPaths The field paths to return.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let collectionRef = firestore.collection('col');
     * let documentRef = collectionRef.doc('doc');
     *
     * return documentRef.set({x:10, y:5}).then(() => {
     *   return collectionRef.where('x', '>', 5).select('y').get();
     * }).then((res) => {
     *   console.log(`y is ${res.docs[0].get('y')}.`);
     * });
     * ```
     */
    select(...fieldPaths: Array<string | FieldPath>): Query;
    /**
     * Creates and returns a new [Query]{@link Query} that's additionally sorted
     * by the specified field, optionally in descending order instead of
     * ascending.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the field mask.
     *
     * @param {string|FieldPath} fieldPath The field to sort by.
     * @param {string=} directionStr Optional direction to sort by ('asc' or
     * 'desc'). If not specified, order will be ascending.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.orderBy('foo', 'desc').get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    orderBy(fieldPath: string | firestore.FieldPath, directionStr?: firestore.OrderByDirection): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} that only returns the
     * first matching documents.
     *
     * This function returns a new (immutable) instance of the Query (rather than
     * modify the existing instance) to impose the limit.
     *
     * @param {number} limit The maximum number of items to return.
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(1).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    limit(limit: number): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} that only returns the
     * last matching documents.
     *
     * You must specify at least one orderBy clause for limitToLast queries,
     * otherwise an exception will be thrown during execution.
     *
     * Results for limitToLast queries cannot be streamed via the `stream()` API.
     *
     * @param limit The maximum number of items to return.
     * @return The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limitToLast(1).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Last matching document is ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    limitToLast(limit: number): Query<AppModelType, DbModelType>;
    /**
     * Specifies the offset of the returned results.
     *
     * This function returns a new (immutable) instance of the
     * [Query]{@link Query} (rather than modify the existing instance)
     * to impose the offset.
     *
     * @param {number} offset The offset to apply to the Query results
     * @returns {Query} The created Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '>', 42);
     *
     * query.limit(10).offset(20).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    offset(offset: number): Query<AppModelType, DbModelType>;
    /**
     * Returns a query that counts the documents in the result set of this
     * query.
     *
     * The returned query, when executed, counts the documents in the result set
     * of this query without actually downloading the documents.
     *
     * Using the returned query to count the documents is efficient because only
     * the final count, not the documents' data, is downloaded. The returned
     * query can count the documents in cases where the result set is
     * prohibitively large to download entirely (thousands of documents).
     *
     * @return a query that counts the documents in the result set of this
     * query. The count can be retrieved from `snapshot.data().count`, where
     * `snapshot` is the `AggregateQuerySnapshot` resulting from running the
     * returned query.
     */
    count(): AggregateQuery<{
        count: firestore.AggregateField<number>;
    }, AppModelType, DbModelType>;
    /**
     * Returns a query that can perform the given aggregations.
     *
     * The returned query, when executed, calculates the specified aggregations
     * over the documents in the result set of this query without actually
     * downloading the documents.
     *
     * Using the returned query to perform aggregations is efficient because only
     * the final aggregation values, not the documents' data, is downloaded. The
     * returned query can perform aggregations of the documents count the
     * documents in cases where the result set is prohibitively large to download
     * entirely (thousands of documents).
     *
     * @param aggregateSpec An `AggregateSpec` object that specifies the aggregates
     * to perform over the result set. The AggregateSpec specifies aliases for each
     * aggregate, which can be used to retrieve the aggregate result.
     * @example
     * ```typescript
     * const aggregateQuery = col.aggregate(query, {
     *   countOfDocs: count(),
     *   totalHours: sum('hours'),
     *   averageScore: average('score')
     * });
     *
     * const aggregateSnapshot = await aggregateQuery.get();
     * const countOfDocs: number = aggregateSnapshot.data().countOfDocs;
     * const totalHours: number = aggregateSnapshot.data().totalHours;
     * const averageScore: number | null = aggregateSnapshot.data().averageScore;
     * ```
     */
    aggregate<T extends firestore.AggregateSpec>(aggregateSpec: T): AggregateQuery<T, AppModelType, DbModelType>;
    /**
     * Returns a query that can perform vector distance (similarity) search with given parameters.
     *
     * The returned query, when executed, performs a distance (similarity) search on the specified
     * `vectorField` against the given `queryVector` and returns the top documents that are closest
     * to the `queryVector`.
     *
     * Only documents whose `vectorField` field is a {@link VectorValue} of the same dimension as `queryVector`
     * participate in the query, all other documents are ignored.
     *
     * @example
     * ```
     * // Returns the closest 10 documents whose Euclidean distance from their 'embedding' fields are closed to [41, 42].
     * const vectorQuery = col.findNearest('embedding', [41, 42], {limit: 10, distanceMeasure: 'EUCLIDEAN'});
     *
     * const querySnapshot = await vectorQuery.get();
     * querySnapshot.forEach(...);
     * ```
     *
     * @param vectorField - A string or {@link FieldPath} specifying the vector field to search on.
     * @param queryVector - The {@link VectorValue} used to measure the distance from `vectorField` values in the documents.
     * @param options - Options control the vector query. `limit` specifies the upper bound of documents to return, must
     * be a positive integer with a maximum value of 1000. `distanceMeasure` specifies what type of distance is calculated
     * when performing the query.
     *
     * @deprecated Use the new {@link findNearest} implementation
     * accepting a single `options` param.
     */
    findNearest(vectorField: string | firestore.FieldPath, queryVector: firestore.VectorValue | Array<number>, options: {
        limit: number;
        distanceMeasure: 'EUCLIDEAN' | 'COSINE' | 'DOT_PRODUCT';
    }): VectorQuery<AppModelType, DbModelType>;
    /**
     * Returns a query that can perform vector distance (similarity) search with given parameters.
     *
     * The returned query, when executed, performs a distance (similarity) search on the specified
     * `vectorField` against the given `queryVector` and returns the top documents that are closest
     * to the `queryVector`.
     *
     * Only documents whose `vectorField` field is a {@link VectorValue} of the same dimension as `queryVector`
     * participate in the query, all other documents are ignored.
     *
     * @example
     * ```
     * // Returns the closest 10 documents whose Euclidean distance from their 'embedding' fields are closed to [41, 42].
     * const vectorQuery = col.findNearest({
     *     vectorField: 'embedding',
     *     queryVector: [41, 42],
     *     limit: 10,
     *     distanceMeasure: 'EUCLIDEAN',
     *     distanceResultField: 'distance',
     *     distanceThreshold: 0.125
     * });
     *
     * const querySnapshot = await aggregateQuery.get();
     * querySnapshot.forEach(...);
     * ```
     * @param options - An argument specifying the behavior of the {@link VectorQuery} returned by this function.
     * See {@link VectorQueryOptions}.
     */
    findNearest(options: VectorQueryOptions): VectorQuery<AppModelType, DbModelType>;
    _findNearest(options: VectorQueryOptions): VectorQuery<AppModelType, DbModelType>;
    /**
     * Returns true if this `Query` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `Query` is equal to the provided value.
     */
    isEqual(other: firestore.Query<AppModelType, DbModelType>): boolean;
    /**
     * Returns the sorted array of inequality filter fields used in this query.
     *
     * @return An array of inequality filter fields sorted lexicographically by FieldPath.
     */
    private getInequalityFilterFields;
    /**
     * Computes the backend ordering semantics for DocumentSnapshot cursors.
     *
     * @private
     * @internal
     * @param cursorValuesOrDocumentSnapshot The snapshot of the document or the
     * set of field values to use as the boundary.
     * @returns The implicit ordering semantics.
     */
    private createImplicitOrderBy;
    /**
     * Builds a Firestore 'Position' proto message.
     *
     * @private
     * @internal
     * @param {Array.<FieldOrder>} fieldOrders The field orders to use for this
     * cursor.
     * @param {Array.<DocumentSnapshot|*>} cursorValuesOrDocumentSnapshot The
     * snapshot of the document or the set of field values to use as the boundary.
     * @param before Whether the query boundary lies just before or after the
     * provided data.
     * @returns {Object} The proto message.
     */
    private createCursor;
    /**
     * Validates that a value used with FieldValue.documentId() is either a
     * string or a DocumentReference that is part of the query`s result set.
     * Throws a validation error or returns a DocumentReference that can
     * directly be used in the Query.
     *
     * @param val The value to validate.
     * @throws If the value cannot be used for this query.
     * @return If valid, returns a DocumentReference that can be used with the
     * query.
     * @private
     * @internal
     */
    private validateReference;
    /**
     * Creates and returns a new [Query]{@link Query} that starts at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start at or the field values to
     * start this query at, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    startAt(...fieldValuesOrDocumentSnapshot: Array<unknown>): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} that starts after the
     * provided set of field values relative to the order of the query. The order
     * of the provided values must match the order of the order by clauses of the
     * query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should start after or the field values to
     * start this query after, in order of the query's order by.
     * @returns {Query} A query with the new starting point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').startAfter(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    startAfter(...fieldValuesOrDocumentSnapshot: Array<unknown>): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} that ends before the set of
     * field values relative to the order of the query. The order of the provided
     * values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end before or the field values to
     * end this query before, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endBefore(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    endBefore(...fieldValuesOrDocumentSnapshot: Array<unknown>): Query<AppModelType, DbModelType>;
    /**
     * Creates and returns a new [Query]{@link Query} that ends at the provided
     * set of field values relative to the order of the query. The order of the
     * provided values must match the order of the order by clauses of the query.
     *
     * @param {...*|DocumentSnapshot} fieldValuesOrDocumentSnapshot The snapshot
     * of the document the query results should end at or the field values to end
     * this query at, in order of the query's order by.
     * @returns {Query} A query with the new ending point.
     *
     * @example
     * ```
     * let query = firestore.collection('col');
     *
     * query.orderBy('foo').endAt(42).get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    endAt(...fieldValuesOrDocumentSnapshot: Array<unknown>): Query<AppModelType, DbModelType>;
    /**
     * Executes the query and returns the results as a
     * [QuerySnapshot]{@link QuerySnapshot}.
     *
     * @returns {Promise.<QuerySnapshot>} A Promise that resolves with the results
     * of the Query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * query.get().then(querySnapshot => {
     *   querySnapshot.forEach(documentSnapshot => {
     *     console.log(`Found document at ${documentSnapshot.ref.path}`);
     *   });
     * });
     * ```
     */
    get(): Promise<QuerySnapshot<AppModelType, DbModelType>>;
    /**
     * Plans and optionally executes this query. Returns a Promise that will be
     * resolved with the planner information, statistics from the query execution (if any),
     * and the query results (if any).
     *
     * @return A Promise that will be resolved with the planner information, statistics
     *  from the query execution (if any), and the query results (if any).
     */
    explain(options?: firestore.ExplainOptions): Promise<ExplainResults<QuerySnapshot<AppModelType, DbModelType>>>;
    /**
     * Internal get() method that accepts an optional transaction options, and
     * returns a query snapshot with transaction and explain metadata.
     *
     * @private
     * @internal
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     */
    _get(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions): Promise<QuerySnapshotResponse<QuerySnapshot<AppModelType, DbModelType>>>;
    _getResponse(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): Promise<QueryResponse<QuerySnapshot<AppModelType, DbModelType>>>;
    /**
     * Executes the query and streams the results as
     * [QueryDocumentSnapshots]{@link QueryDocumentSnapshot}.
     *
     * @returns {Stream.<QueryDocumentSnapshot>} A stream of
     * QueryDocumentSnapshots.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let count = 0;
     *
     * query.stream().on('data', (documentSnapshot) => {
     *   console.log(`Found document with name '${documentSnapshot.id}'`);
     *   ++count;
     * }).on('end', () => {
     *   console.log(`Total count is ${count}`);
     * });
     * ```
     */
    stream(): NodeJS.ReadableStream;
    /**
     * Executes the query and streams the results as the following object:
     * {document?: DocumentSnapshot, metrics?: ExplainMetrics}
     *
     * The stream surfaces documents one at a time as they are received from the
     * server, and at the end, it will surface the metrics associated with
     * executing the query.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let count = 0;
     *
     * query.explainStream({analyze: true}).on('data', (data) => {
     *   if (data.document) {
     *     // Use data.document which is a DocumentSnapshot instance.
     *     console.log(`Found document with name '${data.document.id}'`);
     *     ++count;
     *   }
     *   if (data.metrics) {
     *     // Use data.metrics which is an ExplainMetrics instance.
     *   }
     * }).on('end', () => {
     *   console.log(`Received ${count} documents.`);
     * });
     * ```
     */
    explainStream(explainOptions?: firestore.ExplainOptions): NodeJS.ReadableStream;
    /**
     * Converts a QueryCursor to its proto representation.
     *
     * @param cursor The original cursor value
     * @private
     * @internal
     */
    private toCursor;
    /**
     * Internal method for serializing a query to its RunQuery proto
     * representation with an optional transaction id or read time.
     *
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     * @param explainOptions Options to use for explaining the query (if any).
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    toProto(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): api.IRunQueryRequest;
    /**
     * Converts current Query to an IBundledQuery.
     *
     * @private
     * @internal
     */
    _toBundledQuery(): protos.firestore.IBundledQuery;
    private toStructuredQuery;
    /**
     * @internal
     * @private
     * This method exists solely to maintain backward compatability.
     */
    _isPermanentRpcError(err: GoogleError, methodName: string): boolean;
    /**
     * @internal
     * @private
     * This method exists solely to maintain backward compatability.
     */
    _hasRetryTimedOut(methodName: string, startTime: number): boolean;
    /**
     * Internal streaming method that accepts an optional transaction ID.
     *
     * BEWARE: If `transactionOrReadTime` is `ITransactionOptions`, then the first
     * response in the stream will be a transaction response.
     *
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     * @param explainOptions Options to use for explaining the query (if any).
     * @private
     * @internal
     * @returns A stream of document results, optionally preceded by a transaction response.
     */
    _stream(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): NodeJS.ReadableStream;
    /**
     * Attaches a listener for QuerySnapshot events.
     *
     * @param {querySnapshotCallback} onNext A callback to be called every time
     * a new [QuerySnapshot]{@link QuerySnapshot} is available.
     * @param {errorCallback=} onError A callback to be called if the listen
     * fails or is cancelled. No further callbacks will occur.
     *
     * @returns {function()} An unsubscribe function that can be called to cancel
     * the snapshot listener.
     *
     * @example
     * ```
     * let query = firestore.collection('col').where('foo', '==', 'bar');
     *
     * let unsubscribe = query.onSnapshot(querySnapshot => {
     *   console.log(`Received query snapshot of size ${querySnapshot.size}`);
     * }, err => {
     *   console.log(`Encountered error: ${err}`);
     * });
     *
     * // Remove this listener.
     * unsubscribe();
     * ```
     */
    onSnapshot(onNext: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void, onError?: (error: Error) => void): () => void;
    /**
     * Returns a function that can be used to sort QueryDocumentSnapshots
     * according to the sort criteria of this query.
     *
     * @private
     * @internal
     */
    comparator(): (s1: QueryDocumentSnapshot<AppModelType, DbModelType>, s2: QueryDocumentSnapshot<AppModelType, DbModelType>) => number;
    withConverter(converter: null): Query;
    withConverter<NewAppModelType, NewDbModelType extends firestore.DocumentData = firestore.DocumentData>(converter: firestore.FirestoreDataConverter<NewAppModelType, NewDbModelType>): Query<NewAppModelType, NewDbModelType>;
    /**
     * Construct the resulting snapshot for this query with given documents.
     *
     * @private
     * @internal
     */
    _createSnapshot(readTime: Timestamp, size: number, docs: () => Array<QueryDocumentSnapshot<AppModelType, DbModelType>>, changes: () => Array<DocumentChange<AppModelType, DbModelType>>): QuerySnapshot<AppModelType, DbModelType>;
}
