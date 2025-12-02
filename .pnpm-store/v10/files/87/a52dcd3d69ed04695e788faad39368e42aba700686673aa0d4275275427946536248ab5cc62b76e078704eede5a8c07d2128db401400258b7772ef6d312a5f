"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetUpload = void 0;
const resource_1 = require("../../../../../resource.js");
class AssetUpload extends resource_1.APIResource {
    /**
     * Start uploading a collection of assets for use in a Worker version. To learn
     * more about the direct uploads of assets, see
     * https://developers.cloudflare.com/workers/static-assets/direct-upload/.
     *
     * @example
     * ```ts
     * const assetUpload =
     *   await client.workersForPlatforms.dispatch.namespaces.scripts.assetUpload.create(
     *     'my-dispatch-namespace',
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       manifest: { foo: { hash: 'hash', size: 0 } },
     *     },
     *   );
     * ```
     */
    create(dispatchNamespace, scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/assets-upload-session`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.AssetUpload = AssetUpload;
//# sourceMappingURL=asset-upload.js.map