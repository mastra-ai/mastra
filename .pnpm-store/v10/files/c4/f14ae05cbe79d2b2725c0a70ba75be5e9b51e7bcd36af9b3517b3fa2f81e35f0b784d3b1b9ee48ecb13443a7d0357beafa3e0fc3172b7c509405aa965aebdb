// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Upload extends APIResource {
    /**
     * Start uploading a collection of assets for use in a Worker version. To learn
     * more about the direct uploads of assets, see
     * https://developers.cloudflare.com/workers/static-assets/direct-upload/.
     *
     * @example
     * ```ts
     * const upload =
     *   await client.workers.scripts.assets.upload.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       manifest: { foo: { hash: 'hash', size: 0 } },
     *     },
     *   );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/assets-upload-session`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=upload.mjs.map