"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Keys = void 0;
const resource_1 = require("../../../resource.js");
class Keys extends resource_1.APIResource {
    /**
     * Updates the Access key rotation settings for an account.
     *
     * @example
     * ```ts
     * const key = await client.zeroTrust.access.keys.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   key_rotation_interval_days: 30,
     * });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/access/keys`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets the Access key rotation settings for an account.
     *
     * @example
     * ```ts
     * const key = await client.zeroTrust.access.keys.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/keys`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Perfoms a key rotation for an account.
     *
     * @example
     * ```ts
     * const response = await client.zeroTrust.access.keys.rotate({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    rotate(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/access/keys/rotate`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Keys = Keys;
//# sourceMappingURL=keys.js.map