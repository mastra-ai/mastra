"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Videos = void 0;
const resource_1 = require("../../resource.js");
class Videos extends resource_1.APIResource {
    /**
     * Returns information about an account's storage use.
     *
     * @example
     * ```ts
     * const response = await client.stream.videos.storageUsage({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    storageUsage(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/stream/storage-usage`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Videos = Videos;
//# sourceMappingURL=videos.js.map