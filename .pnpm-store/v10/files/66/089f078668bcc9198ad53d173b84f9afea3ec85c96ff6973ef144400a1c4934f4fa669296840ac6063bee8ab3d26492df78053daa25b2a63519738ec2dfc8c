import * as firestore from '@google-cloud/firestore';
import { QueryPartition } from './query-partition';
import { Query } from './reference/query';
import { Firestore } from './index';
/**
 * A `CollectionGroup` refers to all documents that are contained in a
 * collection or subcollection with a specific collection ID.
 *
 * @class CollectionGroup
 */
export declare class CollectionGroup<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> extends Query<AppModelType, DbModelType> implements firestore.CollectionGroup<AppModelType, DbModelType> {
    /** @private */
    constructor(firestore: Firestore, collectionId: string, converter: firestore.FirestoreDataConverter<AppModelType, DbModelType> | undefined);
    /**
     * Partitions a query by returning partition cursors that can be used to run
     * the query in parallel. The returned cursors are split points that can be
     * used as starting and end points for individual query invocations.
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
     * @param {number} desiredPartitionCount The desired maximum number of
     * partition points. The number must be strictly positive. The actual number
     * of partitions returned may be fewer.
     * @return {AsyncIterable<QueryPartition>} An AsyncIterable of
     * `QueryPartition`s.
     */
    getPartitions(desiredPartitionCount: number): AsyncIterable<QueryPartition<AppModelType, DbModelType>>;
    /**
     * Applies a custom data converter to this `CollectionGroup`, allowing you
     * to use your own custom model objects with Firestore. When you call get()
     * on the returned `CollectionGroup`, the provided converter will convert
     * between Firestore data of type `NewDbModelType` and your custom type
     * `NewAppModelType`.
     *
     * Using the converter allows you to specify generic type arguments when
     * storing and retrieving objects from Firestore.
     *
     * Passing in `null` as the converter parameter removes the current
     * converter.
     *
     * @example
     * ```
     * class Post {
     *   constructor(readonly title: string, readonly author: string) {}
     *
     *   toString(): string {
     *     return this.title + ', by ' + this.author;
     *   }
     * }
     *
     * const postConverter = {
     *   toFirestore(post: Post): FirebaseFirestore.DocumentData {
     *     return {title: post.title, author: post.author};
     *   },
     *   fromFirestore(
     *     snapshot: FirebaseFirestore.QueryDocumentSnapshot
     *   ): Post {
     *     const data = snapshot.data();
     *     return new Post(data.title, data.author);
     *   }
     * };
     *
     * const querySnapshot = await Firestore()
     *   .collectionGroup('posts')
     *   .withConverter(postConverter)
     *   .get();
     * for (const doc of querySnapshot.docs) {
     *   const post = doc.data();
     *   post.title; // string
     *   post.toString(); // Should be defined
     *   post.someNonExistentProperty; // TS error
     * }
     *
     * ```
     * @param {FirestoreDataConverter | null} converter Converts objects to and
     * from Firestore. Passing in `null` removes the current converter.
     * @return {CollectionGroup} A `CollectionGroup` that uses the provided
     * converter.
     */
    withConverter(converter: null): CollectionGroup;
    withConverter<NewAppModelType, NewDbModelType extends firestore.DocumentData = firestore.DocumentData>(converter: firestore.FirestoreDataConverter<NewAppModelType, NewDbModelType>): CollectionGroup<NewAppModelType, NewDbModelType>;
}
