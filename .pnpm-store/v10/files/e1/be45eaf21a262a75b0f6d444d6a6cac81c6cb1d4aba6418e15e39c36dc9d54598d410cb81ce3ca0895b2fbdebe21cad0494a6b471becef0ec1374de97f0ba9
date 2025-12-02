// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class IPLists extends APIResource {
    /**
     * Get IP Lists.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ipList of client.intel.ipLists.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/ip-list`, IPListsSinglePage, options);
    }
}
export class IPListsSinglePage extends SinglePage {
}
IPLists.IPListsSinglePage = IPListsSinglePage;
//# sourceMappingURL=ip-lists.mjs.map