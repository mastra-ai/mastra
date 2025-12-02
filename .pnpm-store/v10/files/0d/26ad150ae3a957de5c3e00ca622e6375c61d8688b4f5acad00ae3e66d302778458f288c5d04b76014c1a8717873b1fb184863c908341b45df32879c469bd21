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
import { AggregateSpec } from '../aggregate';
import { Timestamp } from '../timestamp';
import { ExplainResults } from '../query-profile';
import { AggregateQuerySnapshot } from './aggregate-query-snapshot';
import { Query } from './query';
import { Readable } from 'stream';
import { QueryResponse, QuerySnapshotResponse } from './types';
/**
 * A query that calculates aggregations over an underlying query.
 */
export declare class AggregateQuery<AggregateSpecType extends AggregateSpec, AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.AggregateQuery<AggregateSpecType, AppModelType, DbModelType> {
    private readonly _query;
    private readonly _aggregates;
    private readonly clientAliasToServerAliasMap;
    private readonly serverAliasToClientAliasMap;
    /**
     * @internal
     * @param _query The query whose aggregations will be calculated by this
     * object.
     * @param _aggregates The aggregations that will be performed by this query.
     */
    constructor(_query: Query<AppModelType, DbModelType>, _aggregates: AggregateSpecType);
    /** The query whose aggregations will be calculated by this object. */
    get query(): Query<AppModelType, DbModelType>;
    /**
     * Executes this query.
     *
     * @return A promise that will be resolved with the results of the query.
     */
    get(): Promise<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>;
    /**
     * Internal get() method that accepts an optional transaction options and
     * returns a snapshot with transaction and explain metadata.
     *
     * @private
     * @internal
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     */
    _get(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions): Promise<QuerySnapshotResponse<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>>;
    /**
     * Internal get() method that accepts an optional transaction id, and returns
     * transaction metadata.
     *
     * @private
     * @internal
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     */
    _getResponse(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): Promise<QueryResponse<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>>;
    /**
     * Internal streaming method that accepts an optional transaction ID.
     *
     * BEWARE: If `transactionOrReadTime` is `ITransactionOptions`, then the first
     * response in the stream will be a transaction response.
     *
     * @private
     * @internal
     * @param transactionOrReadTime A transaction ID, options to start a new
     *  transaction, or timestamp to use as read time.
     * @param explainOptions Options to use for explaining the query (if any).
     * @returns A stream of document results optionally preceded by a transaction response.
     */
    _stream(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): Readable;
    /**
     * Internal method to decode values within result.
     * @private
     */
    private decodeResult;
    /**
     * Internal method for serializing a query to its RunAggregationQuery proto
     * representation with an optional transaction id.
     *
     * @private
     * @internal
     * @returns Serialized JSON for the query.
     */
    toProto(transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, explainOptions?: firestore.ExplainOptions): api.IRunAggregationQueryRequest;
    /**
     * Compares this object with the given object for equality.
     *
     * This object is considered "equal" to the other object if and only if
     * `other` performs the same aggregations as this `AggregateQuery` and
     * the underlying Query of `other` compares equal to that of this object
     * using `Query.isEqual()`.
     *
     * @param other The object to compare to this object for equality.
     * @return `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other: firestore.AggregateQuery<AggregateSpecType, AppModelType, DbModelType>): boolean;
    /**
     * Plans and optionally executes this query. Returns a Promise that will be
     * resolved with the planner information, statistics from the query
     * execution (if any), and the query results (if any).
     *
     * @return A Promise that will be resolved with the planner information,
     * statistics from the query execution (if any), and the query results (if any).
     */
    explain(options?: firestore.ExplainOptions): Promise<ExplainResults<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>>;
}
