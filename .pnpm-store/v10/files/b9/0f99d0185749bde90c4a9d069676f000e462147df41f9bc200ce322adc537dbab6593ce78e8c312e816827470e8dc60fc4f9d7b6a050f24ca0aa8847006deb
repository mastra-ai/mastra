// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Whois extends APIResource {
    /**
     * Get WHOIS Record
     *
     * @example
     * ```ts
     * const whois = await client.intel.whois.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/whois`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=whois.mjs.map