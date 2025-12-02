"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metadata = void 0;
const resource_1 = require("../../../resource.js");
class Metadata extends resource_1.APIResource {
    /**
     * Returns the metadata associated with the given key in the given namespace. Use
     * URL-encoding to use special characters (for example, `:`, `!`, `%`) in the key
     * name.
     *
     * @example
     * ```ts
     * const metadata = await client.kv.namespaces.metadata.get(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   'My-Key',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(namespaceId, keyName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/metadata/${keyName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Metadata = Metadata;
//# sourceMappingURL=metadata.js.map