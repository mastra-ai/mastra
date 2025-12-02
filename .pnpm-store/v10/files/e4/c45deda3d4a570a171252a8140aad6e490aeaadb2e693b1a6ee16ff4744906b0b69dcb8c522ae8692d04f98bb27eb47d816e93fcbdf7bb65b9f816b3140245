import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class MetadataIndex extends APIResource {
    /**
     * Enable metadata filtering based on metadata property. Limited to 10 properties.
     *
     * @example
     * ```ts
     * const metadataIndex =
     *   await client.vectorize.indexes.metadataIndex.create(
     *     'example-index',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       indexType: 'string',
     *       propertyName: 'random_metadata_property',
     *     },
     *   );
     * ```
     */
    create(indexName: string, params: MetadataIndexCreateParams, options?: Core.RequestOptions): Core.APIPromise<MetadataIndexCreateResponse | null>;
    /**
     * List Metadata Indexes for the specified Vectorize Index.
     *
     * @example
     * ```ts
     * const metadataIndices =
     *   await client.vectorize.indexes.metadataIndex.list(
     *     'example-index',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(indexName: string, params: MetadataIndexListParams, options?: Core.RequestOptions): Core.APIPromise<MetadataIndexListResponse | null>;
    /**
     * Allow Vectorize to delete the specified metadata index.
     *
     * @example
     * ```ts
     * const metadataIndex =
     *   await client.vectorize.indexes.metadataIndex.delete(
     *     'example-index',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       propertyName: 'random_metadata_property',
     *     },
     *   );
     * ```
     */
    delete(indexName: string, params: MetadataIndexDeleteParams, options?: Core.RequestOptions): Core.APIPromise<MetadataIndexDeleteResponse | null>;
}
export interface MetadataIndexCreateResponse {
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    mutationId?: string;
}
export interface MetadataIndexListResponse {
    /**
     * Array of indexed metadata properties.
     */
    metadataIndexes?: Array<MetadataIndexListResponse.MetadataIndex>;
}
export declare namespace MetadataIndexListResponse {
    interface MetadataIndex {
        /**
         * Specifies the type of indexed metadata property.
         */
        indexType?: 'string' | 'number' | 'boolean';
        /**
         * Specifies the indexed metadata property.
         */
        propertyName?: string;
    }
}
export interface MetadataIndexDeleteResponse {
    /**
     * The unique identifier for the async mutation operation containing the changeset.
     */
    mutationId?: string;
}
export interface MetadataIndexCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Specifies the type of metadata property to index.
     */
    indexType: 'string' | 'number' | 'boolean';
    /**
     * Body param: Specifies the metadata property to index.
     */
    propertyName: string;
}
export interface MetadataIndexListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface MetadataIndexDeleteParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Specifies the metadata property for which the index must be deleted.
     */
    propertyName: string;
}
export declare namespace MetadataIndex {
    export { type MetadataIndexCreateResponse as MetadataIndexCreateResponse, type MetadataIndexListResponse as MetadataIndexListResponse, type MetadataIndexDeleteResponse as MetadataIndexDeleteResponse, type MetadataIndexCreateParams as MetadataIndexCreateParams, type MetadataIndexListParams as MetadataIndexListParams, type MetadataIndexDeleteParams as MetadataIndexDeleteParams, };
}
//# sourceMappingURL=metadata-index.d.ts.map