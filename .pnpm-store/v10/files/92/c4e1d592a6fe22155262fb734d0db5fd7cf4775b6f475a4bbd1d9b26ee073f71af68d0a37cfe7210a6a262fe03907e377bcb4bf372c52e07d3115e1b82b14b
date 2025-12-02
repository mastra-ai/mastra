// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Trace extends APIResource {
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
//# sourceMappingURL=trace.mjs.map