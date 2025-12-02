"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestsV4PagePaginationArray = exports.Tests = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Tests extends resource_1.APIResource {
    /**
     * Starts a test for a specific webpage, in a specific region.
     *
     * @example
     * ```ts
     * const test = await client.speed.pages.tests.create(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(url, params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/speed_api/pages/${url}/tests`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Test history (list of tests) for a specific webpage.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const test of client.speed.pages.tests.list(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(url, params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/speed_api/pages/${url}/tests`, TestsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes all tests for a specific webpage from a specific region. Deleted tests
     * are still counted as part of the quota.
     *
     * @example
     * ```ts
     * const test = await client.speed.pages.tests.delete(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(url, params, options) {
        const { zone_id, region } = params;
        return this._client.delete(`/zones/${zone_id}/speed_api/pages/${url}/tests`, {
            query: { region },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves the result of a specific test.
     *
     * @example
     * ```ts
     * const test = await client.speed.pages.tests.get(
     *   'example.com',
     *   'test_id',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(url, testId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/speed_api/pages/${url}/tests/${testId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Tests = Tests;
class TestsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.TestsV4PagePaginationArray = TestsV4PagePaginationArray;
Tests.TestsV4PagePaginationArray = TestsV4PagePaginationArray;
//# sourceMappingURL=tests.js.map