"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Managed = void 0;
const resource_1 = require("../../../../resource.js");
class Managed extends resource_1.APIResource {
    /**
     * Updates state of public access over the bucket's R2-managed (r2.dev) domain.
     *
     * @example
     * ```ts
     * const managed =
     *   await client.r2.buckets.domains.managed.update(
     *     'example-bucket',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    update(bucketName, params, options) {
        const { account_id, jurisdiction, ...body } = params;
        return this._client.put(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/managed`, {
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
     * Gets state of public access over the bucket's R2-managed (r2.dev) domain.
     *
     * @example
     * ```ts
     * const manageds =
     *   await client.r2.buckets.domains.managed.list(
     *     'example-bucket',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    list(bucketName, params, options) {
        const { account_id, jurisdiction } = params;
        return this._client.get(`/accounts/${account_id}/r2/buckets/${bucketName}/domains/managed`, {
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
exports.Managed = Managed;
//# sourceMappingURL=managed.js.map