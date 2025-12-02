import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Upload extends APIResource {
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
    create(params: UploadCreateParams, options?: Core.RequestOptions): Core.APIPromise<UploadCreateResponse>;
}
export interface UploadCreateResponse {
    /**
     * A "completion" JWT which can be redeemed when creating a Worker version.
     */
    jwt?: string;
}
export interface UploadCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: Whether the file contents are base64-encoded. Must be `true`.
     */
    base64: true;
    /**
     * Body param:
     */
    body: {
        [key: string]: string;
    };
}
export declare namespace Upload {
    export { type UploadCreateResponse as UploadCreateResponse, type UploadCreateParams as UploadCreateParams };
}
//# sourceMappingURL=upload.d.ts.map