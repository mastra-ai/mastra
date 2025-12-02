// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Lifecycle extends APIResource {
    /**
     * Set the object lifecycle rules for a bucket.
     *
     * @example
     * ```ts
     * const lifecycle = await client.r2.buckets.lifecycle.update(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(bucketName, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/lifecycle`, {
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
     * Get object lifecycle rules for a bucket.
     *
     * @example
     * ```ts
     * const lifecycle = await client.r2.buckets.lifecycle.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/lifecycle`, {
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
//# sourceMappingURL=lifecycle.mjs.map