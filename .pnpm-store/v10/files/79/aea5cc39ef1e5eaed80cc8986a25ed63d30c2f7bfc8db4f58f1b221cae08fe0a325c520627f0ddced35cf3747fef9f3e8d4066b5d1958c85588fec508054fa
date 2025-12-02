import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as V1API from "../v1/v1.js";
import * as DirectUploadsAPI from "./direct-uploads.js";
import { DirectUploadCreateParams, DirectUploadCreateResponse, DirectUploads } from "./direct-uploads.js";
export declare class V2 extends APIResource {
    directUploads: DirectUploadsAPI.DirectUploads;
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
    list(params: V2ListParams, options?: Core.RequestOptions): Core.APIPromise<V2ListResponse>;
}
export interface V2ListResponse {
    /**
     * Continuation token to fetch next page. Passed as a query param when requesting
     * List V2 api endpoint.
     */
    continuation_token?: string | null;
    images?: Array<V1API.Image>;
}
export interface V2ListParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Query param: Continuation token for a next page. List images V2 returns
     * continuation_token
     */
    continuation_token?: string | null;
    /**
     * Query param: Number of items per page.
     */
    per_page?: number;
    /**
     * Query param: Sorting order by upload time.
     */
    sort_order?: 'asc' | 'desc';
}
export declare namespace V2 {
    export { type V2ListResponse as V2ListResponse, type V2ListParams as V2ListParams };
    export { DirectUploads as DirectUploads, type DirectUploadCreateResponse as DirectUploadCreateResponse, type DirectUploadCreateParams as DirectUploadCreateParams, };
}
//# sourceMappingURL=v2.d.ts.map