// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Regions extends APIResource {
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
export class RegionListResponsesSinglePage extends SinglePage {
}
Regions.RegionListResponsesSinglePage = RegionListResponsesSinglePage;
//# sourceMappingURL=regions.mjs.map