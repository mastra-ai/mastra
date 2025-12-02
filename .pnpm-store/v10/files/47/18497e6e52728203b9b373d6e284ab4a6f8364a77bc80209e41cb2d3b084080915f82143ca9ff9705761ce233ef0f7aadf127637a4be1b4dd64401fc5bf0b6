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
exports.NamespacesV4PagePaginationArray = exports.Namespaces = void 0;
const resource_1 = require("../../../resource.js");
const KeysAPI = __importStar(require("./keys.js"));
const keys_1 = require("./keys.js");
const MetadataAPI = __importStar(require("./metadata.js"));
const metadata_1 = require("./metadata.js");
const ValuesAPI = __importStar(require("./values.js"));
const values_1 = require("./values.js");
const pagination_1 = require("../../../pagination.js");
class Namespaces extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.keys = new KeysAPI.Keys(this._client);
        this.metadata = new MetadataAPI.Metadata(this._client);
        this.values = new ValuesAPI.Values(this._client);
    }
    /**
     * Creates a namespace under the given title. A `400` is returned if the account
     * already owns a namespace with this title. A namespace must be explicitly deleted
     * to be replaced.
     *
     * @example
     * ```ts
     * const namespace = await client.kv.namespaces.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   title: 'My Own Namespace',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/storage/kv/namespaces`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modifies a namespace's title.
     *
     * @example
     * ```ts
     * const namespace = await client.kv.namespaces.update(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     title: 'My Own Namespace',
     *   },
     * );
     * ```
     */
    update(namespaceId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the namespaces owned by an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const namespace of client.kv.namespaces.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/storage/kv/namespaces`, NamespacesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes the namespace corresponding to the given ID.
     *
     * @example
     * ```ts
     * const namespace = await client.kv.namespaces.delete(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(namespaceId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Remove multiple KV pairs from the namespace. Body should be an array of up to
     * 10,000 keys to be removed.
     *
     * @example
     * ```ts
     * const response = await client.kv.namespaces.bulkDelete(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: ['My-Key'],
     *   },
     * );
     * ```
     */
    bulkDelete(namespaceId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/delete`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve up to 100 KV pairs from the namespace. Keys must contain text-based
     * values. JSON values can optionally be parsed instead of being returned as a
     * string value. Metadata can be included if `withMetadata` is true.
     *
     * @example
     * ```ts
     * const response = await client.kv.namespaces.bulkGet(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     keys: ['My-Key'],
     *   },
     * );
     * ```
     */
    bulkGet(namespaceId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk/get`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Write multiple keys and values at once. Body should be an array of up to 10,000
     * key-value pairs to be stored, along with optional expiration information.
     * Existing values and expirations will be overwritten. If neither `expiration` nor
     * `expiration_ttl` is specified, the key-value pair will never expire. If both are
     * set, `expiration_ttl` is used and `expiration` is ignored. The entire request
     * size must be 100 megabytes or less.
     *
     * @example
     * ```ts
     * const response = await client.kv.namespaces.bulkUpdate(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [{ key: 'My-Key', value: 'Some string' }],
     *   },
     * );
     * ```
     */
    bulkUpdate(namespaceId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/bulk`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get the namespace corresponding to the given ID.
     *
     * @example
     * ```ts
     * const namespace = await client.kv.namespaces.get(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(namespaceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Namespaces = Namespaces;
class NamespacesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.NamespacesV4PagePaginationArray = NamespacesV4PagePaginationArray;
Namespaces.NamespacesV4PagePaginationArray = NamespacesV4PagePaginationArray;
Namespaces.Keys = keys_1.Keys;
Namespaces.KeysCursorLimitPagination = keys_1.KeysCursorLimitPagination;
Namespaces.Metadata = metadata_1.Metadata;
Namespaces.Values = values_1.Values;
//# sourceMappingURL=namespaces.js.map