"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trace = void 0;
const resource_1 = require("../../../resource.js");
class Trace extends resource_1.APIResource {
    /**
     * Get email trace
     *
     * @example
     * ```ts
     * const trace =
     *   await client.emailSecurity.investigate.trace.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/investigate/${postfixId}/trace`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Trace = Trace;
//# sourceMappingURL=trace.js.map