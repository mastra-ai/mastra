import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { type Response } from "../../../_shims/index.js";
export declare class Blobs extends APIResource {
    /**
     * Fetch base image. For most images this will be the originally uploaded file. For
     * larger images it can be a near-lossless version of the original.
     *
     * @example
     * ```ts
     * const blob = await client.images.v1.blobs.get('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     *
     * const content = await blob.blob();
     * console.log(content);
     * ```
     */
    get(imageId: string, params: BlobGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface BlobGetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace Blobs {
    export { type BlobGetParams as BlobGetParams };
}
//# sourceMappingURL=blobs.d.ts.map