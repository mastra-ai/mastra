// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class Upload extends APIResource {
    /**
     * Upload assets ahead of creating a Worker version. To learn more about the direct
     * uploads of assets, see
     * https://developers.cloudflare.com/workers/static-assets/direct-upload/.
     *
     * @example
     * ```ts
     * const upload = await client.workers.assets.upload.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   base64: true,
     *   body: { foo: 'string' },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, base64, body } = params;
        return this._client.post(`/accounts/${account_id}/workers/assets/upload`, Core.multipartFormRequestOptions({ query: { base64 }, body: body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=upload.mjs.map