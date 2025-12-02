"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionListResponsesSinglePage = exports.Regions = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Regions extends resource_1.APIResource {
    /**
     * List all Regional Services regions available for use by this account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const regionListResponse of client.addressing.regionalHostnames.regions.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/regional_hostnames/regions`, RegionListResponsesSinglePage, options);
    }
}
exports.Regions = Regions;
class RegionListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RegionListResponsesSinglePage = RegionListResponsesSinglePage;
Regions.RegionListResponsesSinglePage = RegionListResponsesSinglePage;
//# sourceMappingURL=regions.js.map