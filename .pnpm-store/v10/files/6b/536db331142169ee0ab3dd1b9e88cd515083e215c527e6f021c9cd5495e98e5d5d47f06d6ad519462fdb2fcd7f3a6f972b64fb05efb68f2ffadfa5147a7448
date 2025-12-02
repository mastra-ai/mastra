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
import { Timestamp } from '../timestamp';
import { QueryDocumentSnapshot } from '../document';
import { DocumentChange } from '../document-change';
import { QueryUtil } from './query-util';
import { Query } from './query';
import { VectorQueryOptions } from './vector-query-options';
import { VectorQuerySnapshot } from './vector-query-snapshot';
import { ExplainResults } from '../query-profile';
import { QueryResponse } from './types';
/**
 * A query that finds the documents whose vector fields are closest to a certain query vector.
 * Create an instance of `VectorQuery` with {@link Query.findNearest}.
 */
export declare class VectorQuery<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.VectorQuery<AppModelType, DbModelType> {
    private readonly _query;
    private readonly _options;
    /**
     * @internal
     * @private
     **/
    readonly _queryUtil: QueryUtil<AppModelType, DbModelType, VectorQuery<AppModelType, DbModelType>>;
    /**
     * @private
     * @internal
     */
    constructor(_query: Query<AppModelType, DbModelType>, _options: VectorQueryOptions);
    /** The query whose results participants in the vector search. Filtering
     * performed by the query will apply before the vector search.
     **/
    get query(): Query<AppModelType, DbModelType>;
    /**
     * @private
     * @internal
     */
    private get _rawVectorField();
    /**
     * @private
     * @internal
     */
    private get _rawDistanceResultField();
    /**
     * @private
     * @internal
     */
    private get _rawQueryVector();
    /**
     * Plans and optionally executes this vector search query. Returns a Promise that will be
     * resolved with the planner information, statistics from the query execution (if any),
     * and the query results (if any).
     *
     * @return A Promise that will be resolved with the planner information, statistics
     *  from the query execution (if any), and the query results (if any).
     */
    explain(options?: firestore.ExplainOptions): Promise<ExplainResults<VectorQuerySnapshot<AppModelType, DbModelType>>>;
    /**
     * Executes this vector search query.
     *
     * @returns A promise that will be resolved with the results of the query.
     */
    get(): Promise<VectorQuerySnapshot<AppModelType, DbModelType>>;
    _getResponse(explainOptions?: firestore.ExplainOptions): Promise<QueryResponse<VectorQuerySnapshot<AppModelType, DbModelType>>>;
    /**
     * Internal streaming method that accepts an optional transaction ID.
     *
     * @param transactionId - A transaction ID.
     * @private
     * @internal
     * @returns A stream of document results.
     */
    _stream(transactionId?: Uint8Array): NodeJS.ReadableStream;
    /**
     * Internal method for serializing a query to its proto
     * representation with an optional transaction id.
     *
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    toProto(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): api.IRunQueryRequest;
    /**
     * Construct the resulting vector snapshot for this query with given documents.
     *
     * @private
     * @internal
     */
    _createSnapshot(readTime: Timestamp, size: number, docs: () => Array<QueryDocumentSnapshot<AppModelType, DbModelType>>, changes: () => Array<DocumentChange<AppModelType, DbModelType>>): VectorQuerySnapshot<AppModelType, DbModelType>;
    /**
     * Construct a new vector query whose result will start after To support stream().
     * This now throws an exception because cursors are not supported from the backend for vector queries yet.
     *
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    startAfter(...fieldValuesOrDocumentSnapshot: Array<unknown>): VectorQuery<AppModelType, DbModelType>;
    /**
     * Compares this object with the given object for equality.
     *
     * This object is considered "equal" to the other object if and only if
     * `other` performs the same vector distance search as this `VectorQuery` and
     * the underlying Query of `other` compares equal to that of this object
     * using `Query.isEqual()`.
     *
     * @param other - The object to compare to this object for equality.
     * @returns `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other: firestore.VectorQuery<AppModelType, DbModelType>): boolean;
}
