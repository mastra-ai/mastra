// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as EntriesAPI from "./entries.mjs";
import { Entries, } from "./entries.mjs";
export class ContentLists extends APIResource {
    constructor() {
        super(...arguments);
        this.entries = new EntriesAPI.Entries(this._client);
    }
    /**
     * Update IPFS Universal Path Gateway Content List
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       action: 'block',
     *       entries: [{}],
     *     },
     *   );
     * ```
     */
    update(identifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * IPFS Universal Path Gateway Content List Details
     *
     * @example
     * ```ts
     * const contentList =
     *   await client.web3.hostnames.ipfsUniversalPaths.contentLists.get(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(identifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}/ipfs_universal_path/content_list`, options)._thenUnwrap((obj) => obj.result);
    }
}
ContentLists.Entries = Entries;
//# sourceMappingURL=content-lists.mjs.map