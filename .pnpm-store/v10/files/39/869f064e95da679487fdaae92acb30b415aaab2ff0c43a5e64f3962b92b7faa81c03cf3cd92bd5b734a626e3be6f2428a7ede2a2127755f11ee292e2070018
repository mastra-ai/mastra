"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemporaryCredentials = void 0;
const resource_1 = require("../../resource.js");
class TemporaryCredentials extends resource_1.APIResource {
    /**
     * Creates temporary access credentials on a bucket that can be optionally scoped
     * to prefixes or objects.
     *
     * @example
     * ```ts
     * const temporaryCredential =
     *   await client.r2.temporaryCredentials.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     bucket: 'example-bucket',
     *     parentAccessKeyId: 'example-access-key-id',
     *     permission: 'object-read-write',
     *     ttlSeconds: 3600,
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/r2/temp-access-credentials`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.TemporaryCredentials = TemporaryCredentials;
//# sourceMappingURL=temporary-credentials.js.map