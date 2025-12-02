// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as CloudflareSourceAPI from "./cloudflare-source.mjs";
import { CloudflareSource, } from "./cloudflare-source.mjs";
import { V4PagePaginationArray } from "../../../../pagination.mjs";
export class Subnets extends APIResource {
    constructor() {
        super(...arguments);
        this.cloudflareSource = new CloudflareSourceAPI.CloudflareSource(this._client);
    }
    /**
     * Lists and filters subnets in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const subnetListResponse of client.zeroTrust.networks.subnets.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/zerotrust/subnets`, SubnetListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class SubnetListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Subnets.SubnetListResponsesV4PagePaginationArray = SubnetListResponsesV4PagePaginationArray;
Subnets.CloudflareSource = CloudflareSource;
//# sourceMappingURL=subnets.mjs.map