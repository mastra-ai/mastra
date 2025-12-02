"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkPath = void 0;
const resource_1 = require("../../../../resource.js");
class NetworkPath extends resource_1.APIResource {
    /**
     * Get a breakdown of hops and performance metrics for a specific traceroute test
     * run
     *
     * @example
     * ```ts
     * const networkPath =
     *   await client.zeroTrust.dex.tracerouteTestResults.networkPath.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '01a7362d577a6c3019a474fd6f485823' },
     *   );
     * ```
     */
    get(testResultId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dex/traceroute-test-results/${testResultId}/network-path`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.NetworkPath = NetworkPath;
//# sourceMappingURL=network-path.js.map