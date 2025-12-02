"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Copy = void 0;
const resource_1 = require("../../resource.js");
class Copy extends resource_1.APIResource {
    /**
     * Uploads a video to Stream from a provided URL.
     *
     * @example
     * ```ts
     * const video = await client.stream.copy.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   url: 'https://example.com/myvideo.mp4',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, 'Upload-Creator': uploadCreator, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/copy`, {
            body,
            ...options,
            headers: {
                ...(uploadCreator != null ? { 'Upload-Creator': uploadCreator } : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Copy = Copy;
//# sourceMappingURL=copy.js.map