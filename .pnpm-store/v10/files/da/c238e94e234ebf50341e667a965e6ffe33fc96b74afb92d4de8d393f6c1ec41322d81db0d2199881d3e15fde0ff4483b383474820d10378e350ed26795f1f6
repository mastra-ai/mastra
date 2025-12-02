// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Percentiles extends APIResource {
    /**
     * Get percentiles for an http test for a given time period between 1 hour and 7
     * days.
     *
     * @example
     * ```ts
     * const httpDetailsPercentiles =
     *   await client.zeroTrust.dex.httpTests.percentiles.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       from: '2023-09-20T17:00:00Z',
     *       to: '2023-09-20T17:00:00Z',
     *     },
     *   );
     * ```
     */
    get(testId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/dex/http-tests/${testId}/percentiles`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=percentiles.mjs.map