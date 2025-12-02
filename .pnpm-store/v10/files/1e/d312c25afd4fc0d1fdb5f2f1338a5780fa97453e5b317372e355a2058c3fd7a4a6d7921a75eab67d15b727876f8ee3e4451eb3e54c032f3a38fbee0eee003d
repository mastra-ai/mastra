"use strict";
/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryPartition = void 0;
const field_order_1 = require("./reference/field-order");
const query_1 = require("./reference/query");
const query_options_1 = require("./reference/query-options");
const path_1 = require("./path");
const serializer_1 = require("./serializer");
/**
 * A split point that can be used in a query as a starting and/or end point for
 * the query results. The cursors returned by {@link #startAt} and {@link
 * #endBefore} can only be used in a query that matches the constraint of query
 * that produced this partition.
 *
 * @class QueryPartition
 */
class QueryPartition {
    /** @private */
    constructor(_firestore, _collectionId, _converter, _startAt, _endBefore) {
        this._firestore = _firestore;
        this._collectionId = _collectionId;
        this._converter = _converter;
        this._startAt = _startAt;
        this._endBefore = _endBefore;
        this._serializer = new serializer_1.Serializer(_firestore);
    }
    /**
     * The cursor that defines the first result for this partition or `undefined`
     * if this is the first partition. The cursor value must be
     * destructured when passed to `startAt()` (for example with
     * `query.startAt(...queryPartition.startAt)`).
     *
     * @example
     * ```
     * const query = firestore.collectionGroup('collectionId');
     * for await (const partition of query.getPartitions(42)) {
     *   let partitionedQuery = query.orderBy(FieldPath.documentId());
     *   if (partition.startAt) {
     *     partitionedQuery = partitionedQuery.startAt(...partition.startAt);
     *   }
     *   if (partition.endBefore) {
     *     partitionedQuery = partitionedQuery.endBefore(...partition.endBefore);
     *   }
     *   const querySnapshot = await partitionedQuery.get();
     *   console.log(`Partition contained ${querySnapshot.length} documents`);
     * }
     *
     * ```
     * @type {Array<*>}
     * @return {Array<*>} A cursor value that can be used with {@link
     * Query#startAt} or `undefined` if this is the first partition.
     */
    get startAt() {
        if (this._startAt && !this._memoizedStartAt) {
            this._memoizedStartAt = this._startAt.map(v => this._serializer.decodeValue(v));
        }
        return this._memoizedStartAt;
    }
    /**
     * The cursor that defines the first result after this partition or
     * `undefined` if this is the last partition.  The cursor value must be
     * destructured when passed to `endBefore()` (for example with
     * `query.endBefore(...queryPartition.endBefore)`).
     *
     * @example
     * ```
     * const query = firestore.collectionGroup('collectionId');
     * for await (const partition of query.getPartitions(42)) {
     *   let partitionedQuery = query.orderBy(FieldPath.documentId());
     *   if (partition.startAt) {
     *     partitionedQuery = partitionedQuery.startAt(...partition.startAt);
     *   }
     *   if (partition.endBefore) {
     *     partitionedQuery = partitionedQuery.endBefore(...partition.endBefore);
     *   }
     *   const querySnapshot = await partitionedQuery.get();
     *   console.log(`Partition contained ${querySnapshot.length} documents`);
     * }
     *
     * ```
     * @type {Array<*>}
     * @return {Array<*>} A cursor value that can be used with {@link
     * Query#endBefore} or `undefined` if this is the last partition.
     */
    get endBefore() {
        if (this._endBefore && !this._memoizedEndBefore) {
            this._memoizedEndBefore = this._endBefore.map(v => this._serializer.decodeValue(v));
        }
        return this._memoizedEndBefore;
    }
    /**
     * Returns a query that only encapsulates the documents for this partition.
     *
     * @example
     * ```
     * const query = firestore.collectionGroup('collectionId');
     * for await (const partition of query.getPartitions(42)) {
     *   const partitionedQuery = partition.toQuery();
     *   const querySnapshot = await partitionedQuery.get();
     *   console.log(`Partition contained ${querySnapshot.length} documents`);
     * }
     *
     * ```
     * @return {Query<T>} A query partitioned by a {@link Query#startAt} and
     * {@link Query#endBefore} cursor.
     */
    toQuery() {
        // Since the api.Value to JavaScript type conversion can be lossy (unless
        // `useBigInt` is used), we pass the original protobuf representation to the
        // created query.
        let queryOptions = query_options_1.QueryOptions.forCollectionGroupQuery(this._collectionId, this._converter);
        queryOptions = queryOptions.with({
            fieldOrders: [new field_order_1.FieldOrder(path_1.FieldPath.documentId())],
        });
        if (this._startAt !== undefined) {
            queryOptions = queryOptions.with({
                startAt: { before: true, values: this._startAt },
            });
        }
        if (this._endBefore !== undefined) {
            queryOptions = queryOptions.with({
                endAt: { before: true, values: this._endBefore },
            });
        }
        return new query_1.Query(this._firestore, queryOptions);
    }
}
exports.QueryPartition = QueryPartition;
//# sourceMappingURL=query-partition.js.map