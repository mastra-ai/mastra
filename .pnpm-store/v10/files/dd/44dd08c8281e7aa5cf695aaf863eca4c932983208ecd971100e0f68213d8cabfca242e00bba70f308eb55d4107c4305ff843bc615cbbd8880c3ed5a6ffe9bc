// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class IPs extends APIResource {
    /**
     * Gets the geolocation, ASN, infrastructure type of the ASN, and any security
     * threat categories of an IP address. **Must provide ip query parameters.** For
     * example, `/intel/ip?ipv4=1.1.1.1` or `/intel/ip?ipv6=2001:db8::1`.
     *
     * @example
     * ```ts
     * const ips = await client.intel.ips.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/ip`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=ips.mjs.map