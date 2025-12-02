// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Full extends APIResource {
    /**
     * Lists default sampling, router IPs, warp devices, and rules for account.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.full.get({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mnm/config/full`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=full.mjs.map