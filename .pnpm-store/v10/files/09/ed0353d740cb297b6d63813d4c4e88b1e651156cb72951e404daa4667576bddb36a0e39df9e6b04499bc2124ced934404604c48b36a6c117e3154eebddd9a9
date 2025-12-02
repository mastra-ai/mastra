// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class TemporaryCredentials extends APIResource {
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
//# sourceMappingURL=temporary-credentials.mjs.map