// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class ConnectivityPrecheck extends APIResource {
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
//# sourceMappingURL=connectivity-precheck.mjs.map