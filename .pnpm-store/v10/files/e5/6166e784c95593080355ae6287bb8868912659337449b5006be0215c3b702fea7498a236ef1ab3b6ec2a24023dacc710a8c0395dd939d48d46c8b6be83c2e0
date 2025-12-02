// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ConfigurationsAPI from "./configurations.mjs";
import { Configurations, } from "./configurations.mjs";
import * as ConnectionsAPI from "./connections.mjs";
import { ClientsSinglePage, Connections, } from "./connections.mjs";
import * as ConnectorsAPI from "./connectors.mjs";
import { Connectors } from "./connectors.mjs";
import * as ManagementAPI from "./management.mjs";
import { Management } from "./management.mjs";
import * as TokenAPI from "./token.mjs";
import { Token } from "./token.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Cloudflared extends APIResource {
    constructor() {
        super(...arguments);
        this.configurations = new ConfigurationsAPI.Configurations(this._client);
        this.connections = new ConnectionsAPI.Connections(this._client);
        this.token = new TokenAPI.Token(this._client);
        this.connectors = new ConnectorsAPI.Connectors(this._client);
        this.management = new ManagementAPI.Management(this._client);
    }
    /**
     * Creates a new Cloudflare Tunnel in an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'blog',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cfd_tunnel`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and filters Cloudflare Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const cloudflaredListResponse of client.zeroTrust.tunnels.cloudflared.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cfd_tunnel`, CloudflaredListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a Cloudflare Tunnel from an account.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.tunnels.cloudflared.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(tunnelId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Cloudflare Tunnel.
     *
     * @example
     * ```ts
     * const cloudflared =
     *   await client.zeroTrust.tunnels.cloudflared.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(tunnelId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cfd_tunnel/${tunnelId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class CloudflaredListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Cloudflared.CloudflaredListResponsesV4PagePaginationArray = CloudflaredListResponsesV4PagePaginationArray;
Cloudflared.Configurations = Configurations;
Cloudflared.Connections = Connections;
Cloudflared.ClientsSinglePage = ClientsSinglePage;
Cloudflared.Token = Token;
Cloudflared.Connectors = Connectors;
Cloudflared.Management = Management;
//# sourceMappingURL=cloudflared.mjs.map