// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class DomainHistoryResource extends APIResource {
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
//# sourceMappingURL=domain-history.mjs.map