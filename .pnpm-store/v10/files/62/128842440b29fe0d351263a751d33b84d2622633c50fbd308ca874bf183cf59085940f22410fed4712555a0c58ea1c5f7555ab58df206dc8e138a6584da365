"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPListsSinglePage = exports.IPLists = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class IPLists extends resource_1.APIResource {
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
exports.IPLists = IPLists;
class IPListsSinglePage extends pagination_1.SinglePage {
}
exports.IPListsSinglePage = IPListsSinglePage;
IPLists.IPListsSinglePage = IPListsSinglePage;
//# sourceMappingURL=ip-lists.js.map