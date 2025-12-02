// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class Values extends APIResource {
    /**
     * Write a value identified by a key. Use URL-encoding to use special characters
     * (for example, `:`, `!`, `%`) in the key name. Body should be the value to be
     * stored. If JSON metadata to be associated with the key/value pair is needed, use
     * `multipart/form-data` content type for your PUT request (see dropdown below in
     * `REQUEST BODY SCHEMA`). Existing values, expirations, and metadata will be
     * overwritten. If neither `expiration` nor `expiration_ttl` is specified, the
     * key-value pair will never expire. If both are set, `expiration_ttl` is used and
     * `expiration` is ignored.
     *
     * @example
     * ```ts
     * const value = await client.kv.namespaces.values.update(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   'My-Key',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     value: 'Some Value',
     *   },
     * );
     * ```
     */
    update(namespaceId, keyName, params, options) {
        const { account_id, expiration, expiration_ttl, ...body } = params;
        return this._client.put(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`, Core.multipartFormRequestOptions({ query: { expiration, expiration_ttl }, body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Remove a KV pair from the namespace. Use URL-encoding to use special characters
     * (for example, `:`, `!`, `%`) in the key name.
     *
     * @example
     * ```ts
     * const value = await client.kv.namespaces.values.delete(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   'My-Key',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(namespaceId, keyName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the value associated with the given key in the given namespace. Use
     * URL-encoding to use special characters (for example, `:`, `!`, `%`) in the key
     * name. If the KV-pair is set to expire at some point, the expiration time as
     * measured in seconds since the UNIX epoch will be returned in the `expiration`
     * response header.
     *
     * @example
     * ```ts
     * const value = await client.kv.namespaces.values.get(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   'My-Key',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     *
     * const content = await value.blob();
     * console.log(content);
     * ```
     */
    get(namespaceId, keyName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/storage/kv/namespaces/${namespaceId}/values/${keyName}`, {
            ...options,
            headers: { Accept: 'application/octet-stream', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=values.mjs.map