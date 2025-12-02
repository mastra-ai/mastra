// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class VerificationResource extends APIResource {
    /**
     * Edit SSL validation method for a certificate pack. A PATCH request will request
     * an immediate validation check on any certificate, and return the updated status.
     * If a validation method is provided, the validation will be immediately attempted
     * using that method.
     *
     * @example
     * ```ts
     * const response = await client.ssl.verification.edit(
     *   'a77f8bd7-3b47-46b4-a6f1-75cf98109948',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     validation_method: 'txt',
     *   },
     * );
     * ```
     */
    edit(certificatePackId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/ssl/verification/${certificatePackId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get SSL Verification Info for a Zone.
     *
     * @example
     * ```ts
     * const verifications = await client.ssl.verification.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/ssl/verification`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=verification.mjs.map