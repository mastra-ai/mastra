// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Custom extends APIResource {
    /**
     * Register a new custom domain for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.create(
     *     'example-bucket',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       domain: 'prefix.example-domain.com',
     *       enabled: true,
     *       zoneId: '36ca64a6d92827b8a6b90be344bb1bfd',
     *     },
     *   );
     * ```
     */
    create(bucketName, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.post(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/custom`, {
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
     * Edit the configuration for a custom domain on an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.update(
     *     'example-bucket',
     *     'example-domain/custom-domain.com',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(bucketName, domain, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/custom/${domain}`, {
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
     * Gets a list of all custom domains registered with an existing R2 bucket.
     *
     * @example
     * ```ts
     * const customs = await client.r2.buckets.domains.custom.list(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    list(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/custom`, {
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
     * Remove custom domain registration from an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom =
     *   await client.r2.buckets.domains.custom.delete(
     *     'example-bucket',
     *     'example-domain/custom-domain.com',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(bucketName, domain, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.delete(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/custom/${domain}`, {
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
     * Get the configuration for a custom domain on an existing R2 bucket.
     *
     * @example
     * ```ts
     * const custom = await client.r2.buckets.domains.custom.get(
     *   'example-bucket',
     *   'example-domain/custom-domain.com',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName, domain, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/custom/${domain}`, {
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
//# sourceMappingURL=custom.mjs.map