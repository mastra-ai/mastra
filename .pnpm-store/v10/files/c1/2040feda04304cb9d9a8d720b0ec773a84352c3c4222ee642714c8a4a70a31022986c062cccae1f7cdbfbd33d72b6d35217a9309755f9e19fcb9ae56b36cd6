// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as TestsAPI from "./tests.mjs";
import { Tests, TestsV4PagePaginationArray, } from "./tests.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Pages extends APIResource {
    constructor() {
        super(...arguments);
        this.tests = new TestsAPI.Tests(this._client);
    }
    /**
     * Lists all webpages which have been tested.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const pageListResponse of client.speed.pages.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/speed_api/pages`, PageListResponsesSinglePage, options);
    }
    /**
     * Lists the core web vital metrics trend over time for a specific page.
     *
     * @example
     * ```ts
     * const trend = await client.speed.pages.trend(
     *   'example.com',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     deviceType: 'DESKTOP',
     *     metrics: 'performanceScore,ttfb,fcp,si,lcp,tti,tbt,cls',
     *     region: 'us-central1',
     *     start: '2014-01-01T05:20:00.12345Z',
     *     tz: 'tz',
     *   },
     * );
     * ```
     */
    trend(url, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/speed_api/pages/${url}/trend`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class PageListResponsesSinglePage extends SinglePage {
}
Pages.PageListResponsesSinglePage = PageListResponsesSinglePage;
Pages.Tests = Tests;
Pages.TestsV4PagePaginationArray = TestsV4PagePaginationArray;
//# sourceMappingURL=pages.mjs.map