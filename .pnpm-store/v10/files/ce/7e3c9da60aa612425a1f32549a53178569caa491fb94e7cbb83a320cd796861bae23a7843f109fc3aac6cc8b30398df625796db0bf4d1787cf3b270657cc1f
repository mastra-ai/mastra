"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Content = void 0;
const resource_1 = require("../../resource.js");
class Content extends resource_1.APIResource {
    /**
     * Snippet Content
     *
     * @example
     * ```ts
     * const content = await client.snippets.content.get(
     *   'snippet_name_01',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     *
     * const data = await content.blob();
     * console.log(data);
     * ```
     */
    get(snippetName, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/snippets/${snippetName}/content`, {
            ...options,
            headers: { Accept: 'multipart/form-data', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
exports.Content = Content;
//# sourceMappingURL=content.js.map