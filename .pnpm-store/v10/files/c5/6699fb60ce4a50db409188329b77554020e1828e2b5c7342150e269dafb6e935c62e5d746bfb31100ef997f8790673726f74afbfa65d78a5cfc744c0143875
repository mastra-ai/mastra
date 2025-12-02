import type { FetchOptions } from './fetch';
import type { UpdateOptions } from './update';
import type { QueryOptions } from './query';
import { deleteOne } from './deleteOne';
import type { DeleteOneOptions } from './deleteOne';
import { deleteMany } from './deleteMany';
import type { DeleteManyOptions } from './deleteMany';
import { describeIndexStats } from './describeIndexStats';
import { listPaginated } from './list';
import type { ListOptions } from './list';
import type { HTTPHeaders } from '../pinecone-generated-ts-fetch/data';
import type { PineconeConfiguration, RecordMetadata, PineconeRecord } from './types';
export type { PineconeConfiguration, PineconeRecord, RecordId, RecordSparseValues, RecordValues, RecordMetadata, RecordMetadataValue, } from './types';
export type { DeleteManyOptions, DeleteManyByFilterOptions, DeleteManyByRecordIdOptions, } from './deleteMany';
export type { DeleteOneOptions } from './deleteOne';
export type { DescribeIndexStatsOptions, IndexStatsDescription, IndexStatsNamespaceSummary, } from './describeIndexStats';
export type { FetchOptions, FetchResponse } from './fetch';
export type { UpdateOptions } from './update';
export type { ScoredPineconeRecord, QueryByRecordId, QueryByVectorValues, QueryOptions, QueryResponse, QueryShared, } from './query';
export type { ListOptions } from './list';
/**
 * The `Index` class is used to perform data operations (upsert, query, etc)
 * against Pinecone indexes. Typically it will be instantiated via a `Pinecone`
 * client instance that has already built the required configuration from a
 * combination of sources.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 * const pc = new Pinecone()
 *
 * const index = pc.index('index-name')
 * ```
 *
 * ### Targeting an index, with user-defined Metadata types
 *
 * If you are storing metadata alongside your vector values inside your Pinecone records, you can pass a type parameter to `index()` in order to get proper TypeScript typechecking when upserting and querying data.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 * const pc = new Pinecone();
 *
 * type MovieMetadata = {
 *   title: string,
 *   runtime: numbers,
 *   genre: 'comedy' | 'horror' | 'drama' | 'action'
 * }
 *
 * // Specify a custom metadata type while targeting the index
 * const index = pc.index<MovieMetadata>('test-index');
 *
 * // Now you get type errors if upserting malformed metadata
 * await index.upsert([{
 *   id: '1234',
 *   values: [
 *     .... // embedding values
 *   ],
 *   metadata: {
 *     genre: 'Gone with the Wind',
 *     runtime: 238,
 *     genre: 'drama',
 *
 *     // @ts-expect-error because category property not in MovieMetadata
 *     category: 'classic'
 *   }
 * }])
 *
 * const results = await index.query({
 *    vector: [
 *     ... // query embedding
 *    ],
 *    filter: { genre: { '$eq': 'drama' }}
 * })
 * const movie = results.matches[0];
 *
 * if (movie.metadata) {
 *   // Since we passed the MovieMetadata type parameter above,
 *   // we can interact with metadata fields without having to
 *   // do any typecasting.
 *   const { title, runtime, genre } = movie.metadata;
 *   console.log(`The best match in drama was ${title}`)
 * }
 * ```
 *
 * @typeParam T - The type of metadata associated with each record.
 */
export declare class Index<T extends RecordMetadata = RecordMetadata> {
    /** @internal */
    private config;
    /** @internal */
    private target;
    /**
     * Delete all records from the targeted namespace. To delete all records from across all namespaces,
     * delete the index using {@link Pinecone.deleteIndex} and create a new one using {@link Pinecone.createIndex}.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //    '': { recordCount: 10 },
     * //   foo: { recordCount: 1 }
     * //   },
     * //   dimension: 8,
     * //   indexFullness: 0,
     * //   totalRecordCount: 11
     * // }
     *
     * await index.deleteAll();
     *
     * // Records from namespace 'foo' are now deleted. Records in other namespaces are not modified.
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //   foo: { recordCount: 1 }
     * //   },
     * //   dimension: 8,
     * //   indexFullness: 0,
     * //   totalRecordCount: 1
     * // }
     *
     * await index.deleteAll();
     * // Since no namespace was specified, records in default namespace '' are now deleted.
     *
     * ```
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    deleteAll(): Promise<void>;
    /** @hidden */
    private _deleteAll;
    /**
     * Delete records from the index by either an array of ids, or a filter object.
     * See [Filtering with metadata](https://docs.pinecone.io/docs/metadata-filtering#deleting-vectors-by-metadata-filter)
     * for more on deleting records with filters.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.deleteMany(['record-1', 'record-2']);
     *
     * // or
     * await index.deleteMany({ genre: 'classical' });
     * ```
     * @param options - An array of record id values or a filter object.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    deleteMany(options: DeleteManyOptions): Promise<void>;
    /** @hidden */
    _deleteMany: ReturnType<typeof deleteMany>;
    /**
     * Delete a record from the index by id.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.deleteOne('record-1');
     * ```
     * @param id - The id of the record to delete.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    deleteOne(id: DeleteOneOptions): Promise<void>;
    /** @hidden */
    _deleteOne: ReturnType<typeof deleteOne>;
    /**
     * Describes the index's statistics such as total number of records, records per namespace, and the index's dimension size.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //    '': { recordCount: 10 }
     * //    foo: { recordCount: 2000 },
     * //    bar: { recordCount: 2000 }
     * //   },
     * //   dimension: 1536,
     * //   indexFullness: 0,
     * //   totalRecordCount: 4010
     * // }
     * ```
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link IndexStatsDescription} value when the operation is completed.
     */
    describeIndexStats(): Promise<import("./describeIndexStats").IndexStatsDescription>;
    /** @hidden */
    _describeIndexStats: ReturnType<typeof describeIndexStats>;
    /**
     * The `listPaginated` operation finds vectors based on an id prefix within a single namespace.
     * It returns matching ids in a paginated form, with a pagination token to fetch the next page of results.
     * This id list can then be passed to fetch or delete options to perform operations on the matching records.
     * See [Get record IDs](https://docs.pinecone.io/docs/get-record-ids) for guidance and examples.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const index = pc.index('my-index').namespace('my-namespace');
     *
     * const results = await index.listPaginated({ prefix: 'doc1#' });
     * console.log(results);
     * // {
     * //   vectors: [
     * //     { id: 'doc1#01' }, { id: 'doc1#02' }, { id: 'doc1#03' },
     * //     { id: 'doc1#04' }, { id: 'doc1#05' },  { id: 'doc1#06' },
     * //     { id: 'doc1#07' }, { id: 'doc1#08' }, { id: 'doc1#09' },
     * //     ...
     * //   ],
     * //   pagination: {
     * //     next: 'eyJza2lwX3Bhc3QiOiJwcmVUZXN0LS04MCIsInByZWZpeCI6InByZVRlc3QifQ=='
     * //   },
     * //   namespace: 'my-namespace',
     * //   usage: { readUnits: 1 }
     * // }
     *
     * // Fetch the next page of results
     * await index.listPaginated({ prefix: 'doc1#', paginationToken: results.pagination.next});
     * ```
     *
     * > ⚠️ **Note:**
     * >
     * > `listPaginated` is supported only for serverless indexes.
     *
     * @param options - The {@link ListOptions} for the operation.
     * @returns - A promise that resolves with the {@link ListResponse} when the operation is completed.
     * @throws {@link Errors.PineconeConnectionError} when invalid environment, project id, or index name is configured.
     * @throws {@link Errors.PineconeArgumentError} when invalid arguments are passed.
     */
    listPaginated(options?: ListOptions): Promise<import("../pinecone-generated-ts-fetch/data").ListResponse>;
    /** @hidden */
    _listPaginated: ReturnType<typeof listPaginated>;
    /** @hidden */
    private _fetchCommand;
    /** @hidden */
    private _queryCommand;
    /** @hidden */
    private _updateCommand;
    /** @hidden */
    private _upsertCommand;
    /**
     * Instantiation of Index is handled by {@link Pinecone}
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const index = pc.index('my-index');
     * ```
     *
     * @constructor
     * @param indexName - The name of the index that will receive operations from this {@link Index} instance.
     * @param config - The configuration from the Pinecone client.
     * @param namespace - The namespace for the index.
     * @param indexHostUrl - An optional override for the host address used for data operations.
     * @param additionalHeaders - An optional object of additional header to send with each request.
     */
    constructor(indexName: string, config: PineconeConfiguration, namespace?: string, indexHostUrl?: string, additionalHeaders?: HTTPHeaders);
    /**
     * Returns an {@link Index} targeting the specified namespace. By default, all operations take place inside the default namespace `''`.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * // Create an Index client instance scoped to operate on a
     * // single namespace
     * const ns = pc.index('my-index').namespace('my-namespace');
     *
     * // Now operations against this intance only affect records in
     * // the targeted namespace
     * ns.upsert([
     *   // ... records to upsert in namespace 'my-namespace'
     * ])
     *
     * ns.query({
     *   // ... query records in namespace 'my-namespace'
     * })
     * ```
     * This `namespace()` method will inherit custom metadata types if you are chaining the call off an {@link Index} client instance that is typed with a user-specified metadata type. See {@link Pinecone.index} for more info.
     *
     * @param namespace - The namespace to target within the index. All operations performed with the returned client instance will be scoped only to the targeted namespace.
     * @returns An {@link Index} object that can be used to perform data operations scoped to the specified namespace.
     */
    namespace(namespace: string): Index<T>;
    /**
     * Upsert records to the index.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.upsert([{
     *  id: 'record-1',
     *  values: [0.176, 0.345, 0.263],
     * },{
     *  id: 'record-2',
     *  values: [0.176, 0.345, 0.263],
     * }])
     * ```
     *
     * @param data - An array of {@link PineconeRecord} objects to upsert.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the upsert is completed.
     */
    upsert(data: Array<PineconeRecord<T>>): Promise<void>;
    /**
     * Fetch records from the index.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.fetch(['record-1', 'record-2']);
     * ```
     * @param options - The {@link FetchOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link FetchResponse} when the fetch is completed.
     */
    fetch(options: FetchOptions): Promise<import("./fetch").FetchResponse<T>>;
    /**
     * Query records from the index. Query is used to find the `topK` records in the index whose vector values are most
     * similar to the vector values of the query according to the distance metric you have configured for your index.
     * See [Query data](https://docs.pinecone.io/docs/query-data) for more on querying.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.query({ topK: 3, id: 'record-1'});
     *
     * // or
     * await index.query({ topK: 3, vector: [0.176, 0.345, 0.263] });
     * ```
     *
     * @param options - The {@link QueryOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link QueryResponse} when the query is completed.
     */
    query(options: QueryOptions): Promise<import("./query").QueryResponse<T>>;
    /**
     * Update a record in the index by id.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('imdb-movies');
     *
     * await index.update({
     *   id: '18593',
     *   metadata: { genre: 'romance' },
     * });
     * ```
     *
     * @param options - The {@link UpdateOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the update is completed.
     */
    update(options: UpdateOptions<T>): Promise<void>;
}
