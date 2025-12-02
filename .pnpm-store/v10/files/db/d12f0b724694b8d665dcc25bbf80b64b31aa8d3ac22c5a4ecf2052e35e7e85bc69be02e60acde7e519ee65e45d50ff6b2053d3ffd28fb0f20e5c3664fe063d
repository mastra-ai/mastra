// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DirectUploadsAPI from "./direct-uploads.mjs";
import { DirectUploads } from "./direct-uploads.mjs";
export class V2 extends APIResource {
    constructor() {
        super(...arguments);
        this.directUploads = new DirectUploadsAPI.DirectUploads(this._client);
    }
    /**
     * List up to 10000 images with one request. Use the optional parameters below to
     * get a specific range of images. Endpoint returns continuation_token if more
     * images are present.
     *
     * @example
     * ```ts
     * const v2s = await client.images.v2.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/images/v2`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
V2.DirectUploads = DirectUploads;
//# sourceMappingURL=v2.mjs.map