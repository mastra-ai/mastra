// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Logging extends APIResource {
    /**
     * Updates logging settings for the current Zero Trust account.
     *
     * @example
     * ```ts
     * const loggingSetting =
     *   await client.zeroTrust.gateway.logging.update({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/logging`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the current logging settings for Zero Trust account.
     *
     * @example
     * ```ts
     * const loggingSetting =
     *   await client.zeroTrust.gateway.logging.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/logging`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=logging.mjs.map