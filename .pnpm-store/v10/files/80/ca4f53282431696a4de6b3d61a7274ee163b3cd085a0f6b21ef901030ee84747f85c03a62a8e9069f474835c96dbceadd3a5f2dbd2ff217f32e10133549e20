"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOH = void 0;
const resource_1 = require("../../../resource.js");
class DOH extends resource_1.APIResource {
    /**
     * Updates the DoH settings for your Zero Trust organization.
     *
     * @example
     * ```ts
     * const doh = await client.zeroTrust.organizations.doh.update(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/access/organizations/doh`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the DoH settings for your Zero Trust organization.
     *
     * @example
     * ```ts
     * const doh = await client.zeroTrust.organizations.doh.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/organizations/doh`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.DOH = DOH;
//# sourceMappingURL=doh.js.map