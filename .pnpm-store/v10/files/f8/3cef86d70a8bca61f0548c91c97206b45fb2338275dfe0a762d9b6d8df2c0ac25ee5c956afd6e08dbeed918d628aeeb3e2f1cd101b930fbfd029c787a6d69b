"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entries = void 0;
const resource_1 = require("../../../../../resource.js");
class Entries extends resource_1.APIResource {
    /**
     * Create IPFS Universal Path Gateway Content List Entry
     *
     * @example
     * ```ts
     * const entry =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.create(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       content:
     *         'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
     *       type: 'cid',
     *     },
     *   );
     * ```
     */
    create(identifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit IPFS Universal Path Gateway Content List Entry
     *
     * @example
     * ```ts
     * const entry =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       content:
     *         'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
     *       type: 'cid',
     *     },
     *   );
     * ```
     */
    update(identifier, contentListEntryIdentifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List IPFS Universal Path Gateway Content List Entries
     *
     * @example
     * ```ts
     * const entries =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.list(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(identifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete IPFS Universal Path Gateway Content List Entry
     *
     * @example
     * ```ts
     * const entry =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.delete(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(identifier, contentListEntryIdentifier, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * IPFS Universal Path Gateway Content List Entry Details
     *
     * @example
     * ```ts
     * const entry =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.entries.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(identifier, contentListEntryIdentifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list/entries/${contentListEntryIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Entries = Entries;
//# sourceMappingURL=entries.js.map