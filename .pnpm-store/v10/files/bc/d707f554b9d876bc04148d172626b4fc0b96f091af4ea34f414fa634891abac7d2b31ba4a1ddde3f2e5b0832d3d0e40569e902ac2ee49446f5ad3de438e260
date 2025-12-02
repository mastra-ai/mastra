// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Variants extends APIResource {
    /**
     * Specify variants that allow you to resize images for different use cases.
     *
     * @example
     * ```ts
     * const variant = await client.images.v1.variants.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   id: 'hero',
     *   options: {
     *     fit: 'scale-down',
     *     height: 768,
     *     metadata: 'none',
     *     width: 1366,
     *   },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/images/v1/variants`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists existing variants.
     *
     * @example
     * ```ts
     * const variant = await client.images.v1.variants.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/variants`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deleting a variant purges the cache for all images associated with the variant.
     *
     * @example
     * ```ts
     * const variant = await client.images.v1.variants.delete(
     *   'hero',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(variantId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/images/v1/variants/${variantId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updating a variant purges the cache for all images associated with the variant.
     *
     * @example
     * ```ts
     * const response = await client.images.v1.variants.edit(
     *   'hero',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     options: {
     *       fit: 'scale-down',
     *       height: 768,
     *       metadata: 'none',
     *       width: 1366,
     *     },
     *   },
     * );
     * ```
     */
    edit(variantId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/images/v1/variants/${variantId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch details for a single variant.
     *
     * @example
     * ```ts
     * const variant = await client.images.v1.variants.get(
     *   'hero',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(variantId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/variants/${variantId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=variants.mjs.map