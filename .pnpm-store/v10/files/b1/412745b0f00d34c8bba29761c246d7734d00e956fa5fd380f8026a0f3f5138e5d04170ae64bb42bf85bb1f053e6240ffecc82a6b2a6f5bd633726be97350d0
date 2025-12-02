"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blobs = void 0;
const resource_1 = require("../../../resource.js");
class Blobs extends resource_1.APIResource {
    /**
     * Fetch base image. For most images this will be the originally uploaded file. For
     * larger images it can be a near-lossless version of the original.
     *
     * @example
     * ```ts
     * const blob = await client.images.v1.blobs.get('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     *
     * const content = await blob.blob();
     * console.log(content);
     * ```
     */
    get(imageId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/${imageId}/blob`, {
            ...options,
            headers: { Accept: 'image/*', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
exports.Blobs = Blobs;
//# sourceMappingURL=blobs.js.map