"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.References = void 0;
const resource_1 = require("../../../../resource.js");
class References extends resource_1.APIResource {
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
exports.References = References;
//# sourceMappingURL=references.js.map