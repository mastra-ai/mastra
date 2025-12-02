"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Raw = void 0;
const resource_1 = require("../../../resource.js");
class Raw extends resource_1.APIResource {
    /**
     * Returns the raw eml of any non-benign message.
     *
     * @example
     * ```ts
     * const raw = await client.emailSecurity.investigate.raw.get(
     *   '4Njp3P0STMz2c02Q',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(postfixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/investigate/${postfixId}/raw`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Raw = Raw;
//# sourceMappingURL=raw.js.map