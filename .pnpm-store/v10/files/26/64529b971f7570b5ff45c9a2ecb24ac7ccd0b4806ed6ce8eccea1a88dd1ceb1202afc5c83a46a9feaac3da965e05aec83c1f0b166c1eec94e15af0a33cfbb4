// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Summary extends APIResource {
    /**
     * Get risk score info for all users in the account
     *
     * @example
     * ```ts
     * const summary =
     *   await client.zeroTrust.riskScoring.summary.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zt_risk_scoring/summary`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map