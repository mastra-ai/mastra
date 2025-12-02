// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class NetworkPath extends APIResource {
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
//# sourceMappingURL=network-path.mjs.map