"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reclassify = void 0;
const resource_1 = require("../../../resource.js");
class Reclassify extends resource_1.APIResource {
    /**
     * Change email classfication
     *
     * @example
     * ```ts
     * const reclassify =
     *   await client.emailSecurity.investigate.reclassify.create(
     *     '4Njp3P0STMz2c02Q',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       expected_disposition: 'NONE',
     *     },
     *   );
     * ```
     */
    create(postfixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/investigate/${postfixId}/reclassify`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Reclassify = Reclassify;
//# sourceMappingURL=reclassify.js.map