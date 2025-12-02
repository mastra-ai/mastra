// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as CloudflaredAPI from "./cloudflared/cloudflared.mjs";
import { Cloudflared, CloudflaredListResponsesV4PagePaginationArray, } from "./cloudflared/cloudflared.mjs";
import * as WARPConnectorAPI from "./warp-connector/warp-connector.mjs";
import { WARPConnector, WARPConnectorListResponsesV4PagePaginationArray, } from "./warp-connector/warp-connector.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Tunnels extends APIResource {
    constructor() {
        super(...arguments);
        this.cloudflared = new CloudflaredAPI.Cloudflared(this._client);
        this.warpConnector = new WARPConnectorAPI.WARPConnector(this._client);
    }
    /**
     * Lists and filters all types of Tunnels in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tunnelListResponse of client.zeroTrust.tunnels.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/tunnels`, TunnelListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class TunnelListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Tunnels.TunnelListResponsesV4PagePaginationArray = TunnelListResponsesV4PagePaginationArray;
Tunnels.Cloudflared = Cloudflared;
Tunnels.CloudflaredListResponsesV4PagePaginationArray = CloudflaredListResponsesV4PagePaginationArray;
Tunnels.WARPConnector = WARPConnector;
Tunnels.WARPConnectorListResponsesV4PagePaginationArray = WARPConnectorListResponsesV4PagePaginationArray;
//# sourceMappingURL=tunnels.mjs.map