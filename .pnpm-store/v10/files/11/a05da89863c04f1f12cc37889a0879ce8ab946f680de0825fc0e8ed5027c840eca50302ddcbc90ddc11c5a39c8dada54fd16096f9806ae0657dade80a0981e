"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSV4PagePagination = exports.DNS = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class DNS extends resource_1.APIResource {
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
exports.DNS = DNS;
class DNSV4PagePagination extends pagination_1.V4PagePagination {
}
exports.DNSV4PagePagination = DNSV4PagePagination;
DNS.DNSV4PagePagination = DNSV4PagePagination;
//# sourceMappingURL=dns.js.map