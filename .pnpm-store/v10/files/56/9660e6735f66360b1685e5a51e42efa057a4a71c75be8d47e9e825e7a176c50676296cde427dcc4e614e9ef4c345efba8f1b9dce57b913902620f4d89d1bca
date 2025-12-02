"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TracerouteTests = void 0;
const resource_1 = require("../../../resource.js");
class TracerouteTests extends resource_1.APIResource {
    /**
     * Get test details and aggregate performance metrics for an traceroute test for a
     * given time period between 1 hour and 7 days.
     *
     * @example
     * ```ts
     * const traceroute =
     *   await client.zeroTrust.dex.tracerouteTests.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '1689520412000',
     *       interval: 'minute',
     *       to: '1689606812000',
     *     },
     *   );
     * ```
     */
    get(testId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a breakdown of metrics by hop for individual traceroute test runs
     *
     * @example
     * ```ts
     * const networkPathResponse =
     *   await client.zeroTrust.dex.tracerouteTests.networkPath(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       deviceId: 'deviceId',
     *       from: '1689520412000',
     *       interval: 'minute',
     *       to: '1689606812000',
     *     },
     *   );
     * ```
     */
    networkPath(testId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}/network-path`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get percentiles for a traceroute test for a given time period between 1 hour and
     * 7 days.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.dex.tracerouteTests.percentiles(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '2023-09-20T17:00:00Z',
     *       to: '2023-09-20T17:00:00Z',
     *     },
     *   );
     * ```
     */
    percentiles(testId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/traceroute-tests/${testId}/percentiles`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TracerouteTests = TracerouteTests;
//# sourceMappingURL=traceroute-tests.js.map