// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class IPs extends APIResource {
    /**
     * Fetches routes that contain the given IP address.
     *
     * @example
     * ```ts
     * const teamnet =
     *   await client.zeroTrust.networks.routes.ips.get(
     *     '10.1.0.137',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(ip, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/teamnet/routes/ip/${ip}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ips.mjs.map