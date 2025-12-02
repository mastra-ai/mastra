"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectivityPrecheck = void 0;
const resource_1 = require("../../../resource.js");
class ConnectivityPrecheck extends resource_1.APIResource {
    /**
     * Check whether tokens are valid against the source bucket
     *
     * @example
     * ```ts
     * const response =
     *   await client.r2.superSlurper.connectivityPrecheck.source({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    source(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/slurper/source/connectivity-precheck`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Check whether tokens are valid against the target bucket
     *
     * @example
     * ```ts
     * const response =
     *   await client.r2.superSlurper.connectivityPrecheck.target({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    target(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/slurper/target/connectivity-precheck`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.ConnectivityPrecheck = ConnectivityPrecheck;
//# sourceMappingURL=connectivity-precheck.js.map