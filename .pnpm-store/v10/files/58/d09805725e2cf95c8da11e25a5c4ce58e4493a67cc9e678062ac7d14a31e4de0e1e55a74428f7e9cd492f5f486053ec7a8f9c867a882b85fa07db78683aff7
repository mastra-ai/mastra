"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLNormalization = void 0;
const resource_1 = require("../resource.js");
class URLNormalization extends resource_1.APIResource {
    /**
     * Updates the URL Normalization settings.
     *
     * @example
     * ```ts
     * const urlNormalization =
     *   await client.urlNormalization.update({
     *     zone_id: '9f1839b6152d298aca64c4e906b6d074',
     *     scope: 'incoming',
     *     type: 'cloudflare',
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/url_normalization`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes the URL Normalization settings.
     *
     * @example
     * ```ts
     * await client.urlNormalization.delete({
     *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/url_normalization`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Fetches the current URL Normalization settings.
     *
     * @example
     * ```ts
     * const urlNormalization = await client.urlNormalization.get({
     *   zone_id: '9f1839b6152d298aca64c4e906b6d074',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/url_normalization`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.URLNormalization = URLNormalization;
//# sourceMappingURL=url-normalization.js.map