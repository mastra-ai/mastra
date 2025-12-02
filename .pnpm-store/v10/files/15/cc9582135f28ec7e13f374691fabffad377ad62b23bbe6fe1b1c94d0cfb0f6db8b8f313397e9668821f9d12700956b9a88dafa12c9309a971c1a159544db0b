// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePagination } from "../../pagination.mjs";
export class DNS extends APIResource {
    /**
     * Gets a list of all the domains that have resolved to a specific IP address.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dns of client.intel.dns.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/dns`, DNSV4PagePagination, {
            query,
            ...options,
        });
    }
}
export class DNSV4PagePagination extends V4PagePagination {
}
DNS.DNSV4PagePagination = DNSV4PagePagination;
//# sourceMappingURL=dns.mjs.map