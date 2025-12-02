"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataIndex = void 0;
const resource_1 = require("../../../resource.js");
class MetadataIndex extends resource_1.APIResource {
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
    create(indexName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/metadata_index/create`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    list(indexName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/metadata_index/list`, options)._thenUnwrap((obj) => obj.result);
    }
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
    delete(indexName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/metadata_index/delete`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.MetadataIndex = MetadataIndex;
//# sourceMappingURL=metadata-index.js.map