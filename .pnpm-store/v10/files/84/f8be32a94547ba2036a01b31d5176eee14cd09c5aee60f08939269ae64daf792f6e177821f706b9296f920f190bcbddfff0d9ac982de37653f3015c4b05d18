// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as TokenAPI from "./token.mjs";
import { Token } from "./token.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class WARPConnector extends APIResource {
    constructor() {
        super(...arguments);
        this.token = new TokenAPI.Token(this._client);
    }
    /**
     * Creates a new Warp Connector Tunnel in an account.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'blog',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/warp_connector`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and filters Warp Connector Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const warpConnectorListResponse of client.zeroTrust.tunnels.warpConnector.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/warp_connector`, WARPConnectorListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a Warp Connector Tunnel from an account.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/warp_connector/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing Warp Connector Tunnel.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.tunnels.warpConnector.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(tunnelId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/warp_connector/${tunnelId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Warp Connector Tunnel.
     *
     * @example
     * ```ts
     * const warpConnector =
     *   await client.zeroTrust.tunnels.warpConnector.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/warp_connector/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WARPConnectorListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
WARPConnector.WARPConnectorListResponsesV4PagePaginationArray =
    WARPConnectorListResponsesV4PagePaginationArray;
WARPConnector.Token = Token;
//# sourceMappingURL=warp-connector.mjs.map