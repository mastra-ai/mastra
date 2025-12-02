// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Reclassify extends APIResource {
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
//# sourceMappingURL=reclassify.mjs.map