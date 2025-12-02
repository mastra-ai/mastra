"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Preview = void 0;
const resource_1 = require("../../../resource.js");
class Preview extends resource_1.APIResource {
    /**
     * Preview for non-detection messages
     *
     * @example
     * ```ts
     * const preview =
     *   await client.emailSecurity.investigate.preview.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     postfix_id: '4Njp3P0STMz2c02Q',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/email-security/investigate/preview`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns a preview of the message body as a base64 encoded PNG image for
     * non-benign messages.
     *
     * @example
     * ```ts
     * const preview =
     *   await client.emailSecurity.investigate.preview.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/investigate/${postfixId}/preview`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Preview = Preview;
//# sourceMappingURL=preview.js.map