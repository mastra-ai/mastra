"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipResource = void 0;
const resource_1 = require("../../resource.js");
class ClipResource extends resource_1.APIResource {
    /**
     * Clips a video based on the specified start and end times provided in seconds.
     *
     * @example
     * ```ts
     * const clip = await client.stream.clip.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   clippedFromVideoUID: '023e105f4ecef8ad9ca31a8372d0c353',
     *   endTimeSeconds: 0,
     *   startTimeSeconds: 0,
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/clip`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.ClipResource = ClipResource;
//# sourceMappingURL=clip.js.map