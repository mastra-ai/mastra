// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class SippyResource extends APIResource {
    /**
     * Sets configuration for Sippy for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.update(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(bucketName, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/sippy`, {
            body,
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Disables Sippy on this bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.delete(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.delete(`/accounts/${account_id}/r2/buckets/${bucketName}/sippy`, {
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets configuration for Sippy for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/sippy`, {
            ...options,
            headers: {
                ...(jurisdiction?.toString() != null ?
                    { 'cf-r2-jurisdiction': jurisdiction?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=sippy.mjs.map