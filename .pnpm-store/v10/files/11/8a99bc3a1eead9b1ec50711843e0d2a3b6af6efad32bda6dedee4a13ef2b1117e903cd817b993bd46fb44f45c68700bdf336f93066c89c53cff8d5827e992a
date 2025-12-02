// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as PercentilesAPI from "./percentiles.mjs";
import { Percentiles } from "./percentiles.mjs";
export class HTTPTests extends APIResource {
    constructor() {
        super(...arguments);
        this.percentiles = new PercentilesAPI.Percentiles(this._client);
    }
    /**
     * Get test details and aggregate performance metrics for an http test for a given
     * time period between 1 hour and 7 days.
     *
     * @example
     * ```ts
     * const httpDetails =
     *   await client.zeroTrust.dex.httpTests.get(
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
        return this._client.get(`/accounts/${account_id}/dex/http-tests/${testId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
HTTPTests.Percentiles = Percentiles;
//# sourceMappingURL=http-tests.mjs.map