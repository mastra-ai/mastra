// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class DirectUploads extends APIResource {
    /**
     * Direct uploads allow users to upload images without API keys. A common use case
     * are web apps, client-side applications, or mobile devices where users upload
     * content directly to Cloudflare Images. This method creates a draft record for a
     * future image. It returns an upload URL and an image identifier. To verify if the
     * image itself has been uploaded, send an image details request
     * (accounts/:account_identifier/images/v1/:identifier), and check that the
     * `draft: true` property is not present.
     *
     * @example
     * ```ts
     * const directUpload =
     *   await client.images.v2.directUploads.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/images/v2/direct_upload`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=direct-uploads.mjs.map