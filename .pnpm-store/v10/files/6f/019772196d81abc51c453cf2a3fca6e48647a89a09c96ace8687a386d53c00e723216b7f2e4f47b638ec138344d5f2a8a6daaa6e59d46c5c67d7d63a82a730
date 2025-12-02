"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIndicesSinglePage = exports.Indexes = void 0;
const resource_1 = require("../../../resource.js");
const MetadataIndexAPI = __importStar(require("./metadata-index.js"));
const metadata_index_1 = require("./metadata-index.js");
const pagination_1 = require("../../../pagination.js");
class Indexes extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.metadataIndex = new MetadataIndexAPI.MetadataIndex(this._client);
    }
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
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/vectorize/v2/indexes`, CreateIndicesSinglePage, options);
    }
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
    delete(indexName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    deleteByIds(indexName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/delete_by_ids`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    get(indexName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}`, options)._thenUnwrap((obj) => obj.result);
    }
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
    getByIds(indexName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/get_by_ids`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    info(indexName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/info`, options)._thenUnwrap((obj) => obj.result);
    }
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
    insert(indexName, params, options) {
        const { account_id, body, 'unparsable-behavior': unparsableBehavior } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/insert`, {
            query: { 'unparsable-behavior': unparsableBehavior },
            body: body,
            ...options,
            headers: { 'Content-Type': 'application/x-ndjson', ...options?.headers },
        })._thenUnwrap((obj) => obj.result);
    }
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
    query(indexName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/query`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    upsert(indexName, params, options) {
        const { account_id, body, 'unparsable-behavior': unparsableBehavior } = params;
        return this._client.post(`/accounts/${account_id}/vectorize/v2/indexes/${indexName}/upsert`, {
            query: { 'unparsable-behavior': unparsableBehavior },
            body: body,
            ...options,
            headers: { 'Content-Type': 'application/x-ndjson', ...options?.headers },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Indexes = Indexes;
class CreateIndicesSinglePage extends pagination_1.SinglePage {
}
exports.CreateIndicesSinglePage = CreateIndicesSinglePage;
Indexes.CreateIndicesSinglePage = CreateIndicesSinglePage;
Indexes.MetadataIndex = metadata_index_1.MetadataIndex;
//# sourceMappingURL=indexes.js.map