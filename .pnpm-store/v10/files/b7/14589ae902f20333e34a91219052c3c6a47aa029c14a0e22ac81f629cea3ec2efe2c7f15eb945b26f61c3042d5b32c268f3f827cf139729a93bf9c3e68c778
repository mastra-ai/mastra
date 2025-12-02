import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as BlobsAPI from "./blobs.js";
import { BlobGetParams, Blobs } from "./blobs.js";
import * as KeysAPI from "./keys.js";
import { Key, KeyDeleteParams, KeyDeleteResponse, KeyListParams, KeyListResponse, KeyUpdateParams, KeyUpdateResponse, Keys } from "./keys.js";
import * as StatsAPI from "./stats.js";
import { Stat, StatGetParams, Stats } from "./stats.js";
import * as VariantsAPI from "./variants.js";
import { Variant, VariantCreateParams, VariantCreateResponse, VariantDeleteParams, VariantDeleteResponse, VariantEditParams, VariantEditResponse, VariantGetParams, VariantGetResponse, VariantListParams, Variants } from "./variants.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../../pagination.js";
export declare class V1 extends APIResource {
    keys: KeysAPI.Keys;
    stats: StatsAPI.Stats;
    variants: VariantsAPI.Variants;
    blobs: BlobsAPI.Blobs;
    /**
     * Upload an image with up to 10 Megabytes using a single HTTP POST
     * (multipart/form-data) request. An image can be uploaded by sending an image file
     * or passing an accessible to an API url.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: V1CreateParams, options?: Core.RequestOptions): Core.APIPromise<Image>;
    /**
     * List up to 100 images with one request. Use the optional parameters below to get
     * a specific range of images.
     *
     * @deprecated
     */
    list(params: V1ListParams, options?: Core.RequestOptions): Core.PagePromise<V1ListResponsesV4PagePagination, V1ListResponse>;
    /**
     * Delete an image on Cloudflare Images. On success, all copies of the image are
     * deleted and purged from cache.
     *
     * @example
     * ```ts
     * const v1 = await client.images.v1.delete('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(imageId: string, params: V1DeleteParams, options?: Core.RequestOptions): Core.APIPromise<V1DeleteResponse>;
    /**
     * Update image access control. On access control change, all copies of the image
     * are purged from cache.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.edit('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(imageId: string, params: V1EditParams, options?: Core.RequestOptions): Core.APIPromise<Image>;
    /**
     * Fetch details for a single image.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.get('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(imageId: string, params: V1GetParams, options?: Core.RequestOptions): Core.APIPromise<Image>;
}
export declare class V1ListResponsesV4PagePagination extends V4PagePagination<V1ListResponse> {
}
export interface Image {
    /**
     * Image unique identifier.
     */
    id?: string;
    /**
     * Image file name.
     */
    filename?: string;
    /**
     * User modifiable key-value store. Can be used for keeping references to another
     * system of record for managing images. Metadata must not exceed 1024 bytes.
     */
    meta?: unknown;
    /**
     * Indicates whether the image can be a accessed only using it's UID. If set to
     * true, a signed token needs to be generated with a signing key to view the image.
     */
    requireSignedURLs?: boolean;
    /**
     * When the media item was uploaded.
     */
    uploaded?: string;
    /**
     * Object specifying available variants for an image.
     */
    variants?: Array<string>;
}
export interface V1ListResponse {
    images?: Array<Image>;
}
export type V1DeleteResponse = unknown | string;
export interface V1CreateParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: An optional custom unique identifier for your image.
     */
    id?: string;
    /**
     * Body param: An image binary data. Only needed when type is uploading a file.
     */
    file?: Core.Uploadable;
    /**
     * Body param: User modifiable key-value store. Can use used for keeping references
     * to another system of record for managing images.
     */
    metadata?: unknown;
    /**
     * Body param: Indicates whether the image requires a signature token for the
     * access.
     */
    requireSignedURLs?: boolean;
    /**
     * Body param: A URL to fetch an image from origin. Only needed when type is
     * uploading from a URL.
     */
    url?: string;
}
export interface V1ListParams extends V4PagePaginationParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
}
export interface V1DeleteParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export interface V1EditParams {
    /**
     * Path param: Account identifier tag.
     */
    account_id: string;
    /**
     * Body param: User modifiable key-value store. Can be used for keeping references
     * to another system of record for managing images. No change if not specified.
     */
    metadata?: unknown;
    /**
     * Body param: Indicates whether the image can be accessed using only its UID. If
     * set to `true`, a signed token needs to be generated with a signing key to view
     * the image. Returns a new UID on a change. No change if not specified.
     */
    requireSignedURLs?: boolean;
}
export interface V1GetParams {
    /**
     * Account identifier tag.
     */
    account_id: string;
}
export declare namespace V1 {
    export { type Image as Image, type V1ListResponse as V1ListResponse, type V1DeleteResponse as V1DeleteResponse, V1ListResponsesV4PagePagination as V1ListResponsesV4PagePagination, type V1CreateParams as V1CreateParams, type V1ListParams as V1ListParams, type V1DeleteParams as V1DeleteParams, type V1EditParams as V1EditParams, type V1GetParams as V1GetParams, };
    export { Keys as Keys, type Key as Key, type KeyUpdateResponse as KeyUpdateResponse, type KeyListResponse as KeyListResponse, type KeyDeleteResponse as KeyDeleteResponse, type KeyUpdateParams as KeyUpdateParams, type KeyListParams as KeyListParams, type KeyDeleteParams as KeyDeleteParams, };
    export { Stats as Stats, type Stat as Stat, type StatGetParams as StatGetParams };
    export { Variants as Variants, type Variant as Variant, type VariantCreateResponse as VariantCreateResponse, type VariantDeleteResponse as VariantDeleteResponse, type VariantEditResponse as VariantEditResponse, type VariantGetResponse as VariantGetResponse, type VariantCreateParams as VariantCreateParams, type VariantListParams as VariantListParams, type VariantDeleteParams as VariantDeleteParams, type VariantEditParams as VariantEditParams, type VariantGetParams as VariantGetParams, };
    export { Blobs as Blobs, type BlobGetParams as BlobGetParams };
}
//# sourceMappingURL=v1.d.ts.map