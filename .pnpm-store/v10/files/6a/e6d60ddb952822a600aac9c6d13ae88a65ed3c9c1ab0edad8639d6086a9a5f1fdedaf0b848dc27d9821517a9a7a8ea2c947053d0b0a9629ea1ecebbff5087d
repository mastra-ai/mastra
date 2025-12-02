"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageListResponsesSinglePage = exports.Pages = void 0;
const resource_1 = require("../../../resource.js");
const TestsAPI = __importStar(require("./tests.js"));
const tests_1 = require("./tests.js");
const pagination_1 = require("../../../pagination.js");
class Pages extends resource_1.APIResource {
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
exports.Pages = Pages;
class PageListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PageListResponsesSinglePage = PageListResponsesSinglePage;
Pages.PageListResponsesSinglePage = PageListResponsesSinglePage;
Pages.Tests = tests_1.Tests;
Pages.TestsV4PagePaginationArray = tests_1.TestsV4PagePaginationArray;
//# sourceMappingURL=pages.js.map