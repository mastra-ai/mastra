import * as firestore from '@google-cloud/firestore';
import * as protos from '../protos/firestore_v1_proto_api';
import { Query } from './reference/query';
import { Firestore } from './index';
import api = protos.google.firestore.v1;
/**
 * A split point that can be used in a query as a starting and/or end point for
 * the query results. The cursors returned by {@link #startAt} and {@link
 * #endBefore} can only be used in a query that matches the constraint of query
 * that produced this partition.
 *
 * @class QueryPartition
 */
export declare class QueryPartition<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.QueryPartition<AppModelType, DbModelType> {
    private readonly _firestore;
    private readonly _collectionId;
    private readonly _converter;
    private readonly _startAt;
    private readonly _endBefore;
    private readonly _serializer;
    private _memoizedStartAt;
    private _memoizedEndBefore;
    /** @private */
    constructor(_firestore: Firestore, _collectionId: string, _converter: firestore.FirestoreDataConverter<AppModelType, DbModelType>, _startAt: api.IValue[] | undefined, _endBefore: api.IValue[] | undefined);
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
    get startAt(): unknown[] | undefined;
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
    get endBefore(): unknown[] | undefined;
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
    toQuery(): Query<AppModelType, DbModelType>;
}
