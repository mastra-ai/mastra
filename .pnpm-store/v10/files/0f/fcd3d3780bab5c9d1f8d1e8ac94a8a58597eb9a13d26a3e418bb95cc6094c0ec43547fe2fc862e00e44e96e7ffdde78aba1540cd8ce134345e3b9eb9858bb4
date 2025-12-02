"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Limits = void 0;
const resource_1 = require("../../../resource.js");
class Limits extends resource_1.APIResource {
    /**
     * Fetch limits associated with DLP for account
     *
     * @example
     * ```ts
     * const limits = await client.zeroTrust.dlp.limits.list({
     *   account_id: 'account_id',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/limits`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Limits = Limits;
//# sourceMappingURL=limits.js.map