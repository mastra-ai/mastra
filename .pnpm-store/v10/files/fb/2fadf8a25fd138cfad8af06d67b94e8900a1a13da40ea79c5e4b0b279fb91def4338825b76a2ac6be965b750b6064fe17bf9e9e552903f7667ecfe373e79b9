"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Behaviours = void 0;
const resource_1 = require("../../../resource.js");
class Behaviours extends resource_1.APIResource {
    /**
     * Update configuration for risk behaviors
     *
     * @example
     * ```ts
     * const behaviour =
     *   await client.zeroTrust.riskScoring.behaviours.update({
     *     account_id: 'account_id',
     *     behaviors: {
     *       foo: { enabled: true, risk_level: 'low' },
     *     },
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/zt_risk_scoring/behaviors`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get all behaviors and associated configuration
     *
     * @example
     * ```ts
     * const behaviour =
     *   await client.zeroTrust.riskScoring.behaviours.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zt_risk_scoring/behaviors`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Behaviours = Behaviours;
//# sourceMappingURL=behaviours.js.map