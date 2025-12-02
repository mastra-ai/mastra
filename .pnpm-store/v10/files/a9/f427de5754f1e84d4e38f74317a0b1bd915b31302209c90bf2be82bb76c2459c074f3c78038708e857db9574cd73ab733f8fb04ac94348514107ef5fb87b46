// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class CORS extends APIResource {
    /**
     * Set the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.update(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(bucketName, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/cors`, {
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
     * Delete the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.delete(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.delete(`/accounts/${account_id}/r2/buckets/${bucketName}/cors`, {
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
     * Get the CORS policy for a bucket.
     *
     * @example
     * ```ts
     * const cors = await client.r2.buckets.cors.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/cors`, {
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
//# sourceMappingURL=cors.mjs.map