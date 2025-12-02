"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Variants = void 0;
const resource_1 = require("../../resource.js");
class Variants extends resource_1.APIResource {
    /**
     * Variant support enables caching variants of images with certain file extensions
     * in addition to the original. This only applies when the origin server sends the
     * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
     * does not serve the variant requested, the response will not be cached. This will
     * be indicated with BYPASS cache status in the response headers.
     *
     * @example
     * ```ts
     * const variant = await client.cache.variants.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/cache/variants`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Variant support enables caching variants of images with certain file extensions
     * in addition to the original. This only applies when the origin server sends the
     * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
     * does not serve the variant requested, the response will not be cached. This will
     * be indicated with BYPASS cache status in the response headers.
     *
     * @example
     * ```ts
     * const response = await client.cache.variants.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   value: {},
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/cache/variants`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Variant support enables caching variants of images with certain file extensions
     * in addition to the original. This only applies when the origin server sends the
     * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
     * does not serve the variant requested, the response will not be cached. This will
     * be indicated with BYPASS cache status in the response headers.
     *
     * @example
     * ```ts
     * const variant = await client.cache.variants.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/cache/variants`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Variants = Variants;
//# sourceMappingURL=variants.js.map