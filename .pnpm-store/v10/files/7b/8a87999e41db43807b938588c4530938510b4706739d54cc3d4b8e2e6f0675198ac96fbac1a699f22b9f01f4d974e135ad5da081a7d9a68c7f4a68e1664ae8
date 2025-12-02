"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyGetResponsesSinglePage = exports.Keys = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Keys extends resource_1.APIResource {
    /**
     * Creates an RSA private key in PEM and JWK formats. Key files are only displayed
     * once after creation. Keys are created, used, and deleted independently of
     * videos, and every key can sign any video.
     *
     * @example
     * ```ts
     * const keys = await client.stream.keys.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: {},
     * });
     * ```
     */
    create(params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/stream/keys`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes signing keys and revokes all signed URLs generated with the key.
     *
     * @example
     * ```ts
     * const key = await client.stream.keys.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/keys/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists the video ID and creation date and time when a signing key was created.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const keyGetResponse of client.stream.keys.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/keys`, KeyGetResponsesSinglePage, options);
    }
}
exports.Keys = Keys;
class KeyGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.KeyGetResponsesSinglePage = KeyGetResponsesSinglePage;
Keys.KeyGetResponsesSinglePage = KeyGetResponsesSinglePage;
//# sourceMappingURL=keys.js.map