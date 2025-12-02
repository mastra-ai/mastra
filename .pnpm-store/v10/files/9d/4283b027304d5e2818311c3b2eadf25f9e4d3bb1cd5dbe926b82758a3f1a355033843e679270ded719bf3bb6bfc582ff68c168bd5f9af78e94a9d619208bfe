// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class References extends APIResource {
    /**
     * Get risk score integration by reference id.
     *
     * @example
     * ```ts
     * const reference =
     *   await client.zeroTrust.riskScoring.integrations.references.get(
     *     'reference_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(referenceId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zt_risk_scoring/integrations/reference_id/${referenceId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=references.mjs.map