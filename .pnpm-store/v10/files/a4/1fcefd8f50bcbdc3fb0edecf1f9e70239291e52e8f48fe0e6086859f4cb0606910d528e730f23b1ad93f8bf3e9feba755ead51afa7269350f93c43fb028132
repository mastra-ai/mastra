import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as MetadataIndexAPI from "./metadata-index.js";
import { MetadataIndex, MetadataIndexCreateParams, MetadataIndexCreateResponse, MetadataIndexDeleteParams, MetadataIndexDeleteResponse, MetadataIndexListParams, MetadataIndexListResponse } from "./metadata-index.js";
import { SinglePage } from "../../../pagination.js";
export declare class Indexes extends APIResource {
    metadataIndex: MetadataIndexAPI.MetadataIndex;
    /**
     * Creates and returns a new Vectorize Index.
     *
     * @example
     * ```ts
     * const createIndex = await client.vectorize.indexes.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   config: { dimensions: 768, metric: 'cosine' },
     *   name: 'example-index',
     * });
     * ```
     */
    create(params: IndexCreateParams, options?: Core.RequestOptions): Core.APIPromise<CreateIndex | null>;
    /**
     * Returns a list of Vectorize Indexes
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const createIndex of client.vectorize.indexes.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: IndexListParams, options?: Core.RequestOptions): Core.PagePromise<CreateIndicesSinglePage, CreateIndex>;
    /**
     * Deletes the specified Vectorize Index.
     *
     * @example
     * ```ts
     * const index = await client.vectorize.indexes.delete(
     *   'example-index',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(indexName: string, params: IndexDeleteParams, options?: Core.RequestOptions): Core.APIPromise<IndexDeleteResponse | null>;
    /**
     * Delete a set of vectors from an index by their vector identifiers.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.deleteByIds(
     *   'example-index',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    deleteByIds(indexName: string, params: IndexDeleteByIDsParams, options?: Core.RequestOptions): Core.APIPromise<IndexDeleteByIDsResponse | null>;
    /**
     * Returns the specified Vectorize Index.
     *
     * @example
     * ```ts
     * const createIndex = await client.vectorize.indexes.get(
     *   'example-index',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(indexName: string, params: IndexGetParams, options?: Core.RequestOptions): Core.APIPromise<CreateIndex | null>;
    /**
     * Get a set of vectors from an index by their vector identifiers.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.getByIds(
     *   'example-index',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    getByIds(indexName: string, params: IndexGetByIDsParams, options?: Core.RequestOptions): Core.APIPromise<IndexGetByIDsResponse | null>;
    /**
     * Get information about a vectorize index.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.info(
     *   'example-index',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    info(indexName: string, params: IndexInfoParams, options?: Core.RequestOptions): Core.APIPromise<IndexInfoResponse | null>;
    /**
     * Inserts vectors into the specified index and returns a mutation id corresponding
     * to the vectors enqueued for insertion.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.insert(
     *   'example-index',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: '@/path/to/vectors.ndjson',
     *   },
     * );
     * ```
     */
    insert(indexName: string, params: IndexInsertParams, options?: Core.RequestOptions): Core.APIPromise<IndexInsertResponse | null>;
    /**
     * Finds vectors closest to a given vector in an index.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.query(
     *   'example-index',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     vector: [0.5, 0.5, 0.5],
     *   },
     * );
     * ```
     */
    query(indexName: string, params: IndexQueryParams, options?: Core.RequestOptions): Core.APIPromise<IndexQueryResponse | null>;
    /**
     * Upserts vectors into the specified index, creating them if they do not exist and
     * returns a mutation id corresponding to the vectors enqueued for upsertion.
     *
     * @example
     * ```ts
     * const response = await client.vectorize.indexes.upsert(
     *   'example-index',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: '@/path/to/vectors.ndjson',
     *   },
     * );
     * ```
     */
    upsert(indexName: string, params: IndexUpsertParams, options?: Core.RequestOptions): Core.APIPromise<IndexUpsertResponse | null>;
}
export declare class CreateIndicesSinglePage extends SinglePage<CreateIndex> {
}
export interface CreateIndex {
    config?: IndexDimensionConfiguration;
    /**
     * Specifies the timestamp the resource was created as an ISO8601 string.
     */
    created_on?: string;
    /**
     * Specifies the description of the index.
     */
    description?: string;
    /**
     * Specifies the timestamp the resource was modified as an ISO8601 string.
     */
    modified_on?: string;
    name?: string;
}
export interface IndexDeleteVectorsByID {
    /**
     * The count of the vectors successfully deleted.
     */
    count?: number;
    /**
     * Array of vector identifiers of the vectors that were successfully processed for
     * deletion.
     */
    ids?: Array<string>;
}
export interface IndexDimensionConfiguration {
    /**
     * Specifies the number of dimensions for the index
     */
    dimensions: number;
    /**
     * Specifies the type of metric to use calculating distance.
     */
    metric: 'cosine' | 'euclidean' | 'dot-product';
}
export interface IndexDimensionConfigurationParam {
    /**
     * Specifies the number of dimensions for the index
     */
    dimensions: number;
    /**
     * Specifies the type of metric to use calculating distance.
     */
    metric: 'cosine' | 'euclidean' | 'dot-product';
}
export interface IndexInsert {
    /**
     * Specifies the count of the vectors successfully inserted.
     */
    count?: number;
    /**
     * Array of vector identifiers of the vectors successfully inserted.
     */
    ids?: Array<string>;
}
export interface IndexQuery {
    /**
     * Specifies the count of vectors returned by the search
     */
    count?: number;
    /**
     * Array of vectors matched by the search
     */
    matches?: Array<IndexQuery.Match>;
}
export declare namespace IndexQuery {
    interface Match {
        /**
         * Identifier for a Vector
         */
        id?: string;
        metadata?: unknown | null;
        /**
         * The score of the vector according to the index's distance metric
         */
        score?: number;
        values?: Array<number> | null;
    }
}
export interface IndexUpsert {
    /**
     * Specifies the count of the vectors successfully inserted.
     */
    count?: number;
    /**
     * Array of vector identifiers of the vectors successfully inserted.
     */
    ids?: Array<string>;
}
export type IndexDeleteResponse = unknown | string;
export interface IndexDeleteByIDsResponse {
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    mutationId?: string;
}
/**
 * Array of vectors with matching ids.
 */
export type IndexGetByIDsResponse = unknown;
export interface IndexInfoResponse {
    /**
     * Specifies the number of dimensions for the index
     */
    dimensions?: number;
    /**
     * Specifies the timestamp the last mutation batch was processed as an ISO8601
     * string.
     */
    processedUpToDatetime?: string | null;
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    processedUpToMutation?: string;
    /**
     * Specifies the number of vectors present in the index
     */
    vectorCount?: number;
}
export interface IndexInsertResponse {
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    mutationId?: string;
}
export interface IndexQueryResponse {
    /**
     * Specifies the count of vectors returned by the search
     */
    count?: number;
    /**
     * Array of vectors matched by the search
     */
    matches?: Array<IndexQueryResponse.Match>;
}
export declare namespace IndexQueryResponse {
    interface Match {
        /**
         * Identifier for a Vector
         */
        id?: string;
        metadata?: unknown | null;
        namespace?: string | null;
        /**
         * The score of the vector according to the index's distance metric
         */
        score?: number;
        values?: Array<number> | null;
    }
}
export interface IndexUpsertResponse {
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    mutationId?: string;
}
export interface IndexCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Specifies the type of configuration to use for the index.
     */
    config: IndexDimensionConfigurationParam | IndexCreateParams.VectorizeIndexPresetConfiguration;
    /**
     * Body param:
     */
    name: string;
    /**
     * Body param: Specifies the description of the index.
     */
    description?: string;
}
export declare namespace IndexCreateParams {
    interface VectorizeIndexPresetConfiguration {
        /**
         * Specifies the preset to use for the index.
         */
        preset: '@cf/baai/bge-small-en-v1.5' | '@cf/baai/bge-base-en-v1.5' | '@cf/baai/bge-large-en-v1.5' | 'openai/text-embedding-ada-002' | 'cohere/embed-multilingual-v2.0';
    }
}
export interface IndexListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndexDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndexDeleteByIDsParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: A list of vector identifiers to delete from the index indicated by
     * the path.
     */
    ids?: Array<string>;
}
export interface IndexGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndexGetByIDsParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: A list of vector identifiers to retrieve from the index indicated by
     * the path.
     */
    ids?: Array<string>;
}
export interface IndexInfoParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface IndexInsertParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: ndjson file containing vectors to insert.
     */
    body: string;
    /**
     * Query param: Behavior for ndjson parse failures.
     */
    'unparsable-behavior'?: 'error' | 'discard';
}
export interface IndexQueryParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: The search vector that will be used to find the nearest neighbors.
     */
    vector: Array<number>;
    /**
     * Body param: A metadata filter expression used to limit nearest neighbor results.
     */
    filter?: unknown;
    /**
     * Body param: Whether to return no metadata, indexed metadata or all metadata
     * associated with the closest vectors.
     */
    returnMetadata?: 'none' | 'indexed' | 'all';
    /**
     * Body param: Whether to return the values associated with the closest vectors.
     */
    returnValues?: boolean;
    /**
     * Body param: The number of nearest neighbors to find.
     */
    topK?: number;
}
export interface IndexUpsertParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: ndjson file containing vectors to upsert.
     */
    body: string;
    /**
     * Query param: Behavior for ndjson parse failures.
     */
    'unparsable-behavior'?: 'error' | 'discard';
}
export declare namespace Indexes {
    export { type CreateIndex as CreateIndex, type IndexDeleteVectorsByID as IndexDeleteVectorsByID, type IndexDimensionConfiguration as IndexDimensionConfiguration, type IndexInsert as IndexInsert, type IndexQuery as IndexQuery, type IndexUpsert as IndexUpsert, type IndexDeleteResponse as IndexDeleteResponse, type IndexDeleteByIDsResponse as IndexDeleteByIDsResponse, type IndexGetByIDsResponse as IndexGetByIDsResponse, type IndexInfoResponse as IndexInfoResponse, type IndexInsertResponse as IndexInsertResponse, type IndexQueryResponse as IndexQueryResponse, type IndexUpsertResponse as IndexUpsertResponse, CreateIndicesSinglePage as CreateIndicesSinglePage, type IndexCreateParams as IndexCreateParams, type IndexListParams as IndexListParams, type IndexDeleteParams as IndexDeleteParams, type IndexDeleteByIDsParams as IndexDeleteByIDsParams, type IndexGetParams as IndexGetParams, type IndexGetByIDsParams as IndexGetByIDsParams, type IndexInfoParams as IndexInfoParams, type IndexInsertParams as IndexInsertParams, type IndexQueryParams as IndexQueryParams, type IndexUpsertParams as IndexUpsertParams, };
    export { MetadataIndex as MetadataIndex, type MetadataIndexCreateResponse as MetadataIndexCreateResponse, type MetadataIndexListResponse as MetadataIndexListResponse, type MetadataIndexDeleteResponse as MetadataIndexDeleteResponse, type MetadataIndexCreateParams as MetadataIndexCreateParams, type MetadataIndexListParams as MetadataIndexListParams, type MetadataIndexDeleteParams as MetadataIndexDeleteParams, };
}
//# sourceMappingURL=indexes.d.ts.map