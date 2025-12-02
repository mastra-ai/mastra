"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainHistoryResource = void 0;
const resource_1 = require("../../resource.js");
class DomainHistoryResource extends resource_1.APIResource {
    /**
     * Gets historical security threat and content categories currently and previously
     * assigned to a domain.
     *
     * @example
     * ```ts
     * const domainHistories =
     *   await client.intel.domainHistory.get({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/domain-history`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.DomainHistoryResource = DomainHistoryResource;
//# sourceMappingURL=domain-history.js.map