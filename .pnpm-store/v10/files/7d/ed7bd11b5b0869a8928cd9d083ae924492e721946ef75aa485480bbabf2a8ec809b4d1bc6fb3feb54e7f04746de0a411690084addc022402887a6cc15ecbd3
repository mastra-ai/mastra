import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
export declare class AssetUpload extends APIResource {
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
    create(dispatchNamespace: string, scriptName: string, params: AssetUploadCreateParams, options?: Core.RequestOptions): Core.APIPromise<AssetUploadCreateResponse>;
}
export interface AssetUploadCreateResponse {
    /**
     * The requests to make to upload assets.
     */
    buckets?: Array<Array<string>>;
    /**
     * A JWT to use as authentication for uploading assets.
     */
    jwt?: string;
}
export interface AssetUploadCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: A manifest ([path]: {hash, size}) map of files to upload. As an
     * example, `/blog/hello-world.html` would be a valid path key.
     */
    manifest: {
        [key: string]: AssetUploadCreateParams.Manifest;
    };
}
export declare namespace AssetUploadCreateParams {
    interface Manifest {
        /**
         * The hash of the file.
         */
        hash: string;
        /**
         * The size of the file in bytes.
         */
        size: number;
    }
}
export declare namespace AssetUpload {
    export { type AssetUploadCreateResponse as AssetUploadCreateResponse, type AssetUploadCreateParams as AssetUploadCreateParams, };
}
//# sourceMappingURL=asset-upload.d.ts.map