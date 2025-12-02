// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as IPFSUniversalPathsAPI from "./ipfs-universal-paths/ipfs-universal-paths.mjs";
import { IPFSUniversalPaths } from "./ipfs-universal-paths/ipfs-universal-paths.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Hostnames extends APIResource {
    constructor() {
        super(...arguments);
        this.ipfsUniversalPaths = new IPFSUniversalPathsAPI.IPFSUniversalPaths(this._client);
    }
    /**
     * Create Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'gateway.example.com',
     *   target: 'ipfs',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/web3/hostnames`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Web3 Hostnames
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hostname of client.web3.hostnames.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/web3/hostnames`, HostnamesSinglePage, options);
    }
    /**
     * Delete Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/web3/hostnames/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(identifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/web3/hostnames/${identifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Web3 Hostname Details
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/web3/hostnames/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class HostnamesSinglePage extends SinglePage {
}
Hostnames.HostnamesSinglePage = HostnamesSinglePage;
Hostnames.IPFSUniversalPaths = IPFSUniversalPaths;
//# sourceMappingURL=hostnames.mjs.map