import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Watermarks extends APIResource {
    /**
     * Creates watermark profiles using a single `HTTP POST multipart/form-data`
     * request.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   file: '@/Users/rchen/Downloads/watermark.png',
     * });
     * ```
     */
    create(params: WatermarkCreateParams, options?: Core.RequestOptions): Core.APIPromise<Watermark>;
    /**
     * Lists all watermark profiles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const watermark of client.stream.watermarks.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: WatermarkListParams, options?: Core.RequestOptions): Core.PagePromise<WatermarksSinglePage, Watermark>;
    /**
     * Deletes a watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier: string, params: WatermarkDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WatermarkDeleteResponse>;
    /**
     * Retrieves details for a single watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier: string, params: WatermarkGetParams, options?: Core.RequestOptions): Core.APIPromise<Watermark>;
}
export declare class WatermarksSinglePage extends SinglePage<Watermark> {
}
export interface Watermark {
    /**
     * The date and a time a watermark profile was created.
     */
    created?: string;
    /**
     * The source URL for a downloaded image. If the watermark profile was created via
     * direct upload, this field is null.
     */
    downloadedFrom?: string;
    /**
     * The height of the image in pixels.
     */
    height?: number;
    /**
     * A short description of the watermark profile.
     */
    name?: string;
    /**
     * The translucency of the image. A value of `0.0` makes the image completely
     * transparent, and `1.0` makes the image completely opaque. Note that if the image
     * is already semi-transparent, setting this to `1.0` will not make the image
     * completely opaque.
     */
    opacity?: number;
    /**
     * The whitespace between the adjacent edges (determined by position) of the video
     * and the image. `0.0` indicates no padding, and `1.0` indicates a fully padded
     * video width or length, as determined by the algorithm.
     */
    padding?: number;
    /**
     * The location of the image. Valid positions are: `upperRight`, `upperLeft`,
     * `lowerLeft`, `lowerRight`, and `center`. Note that `center` ignores the
     * `padding` parameter.
     */
    position?: string;
    /**
     * The size of the image relative to the overall size of the video. This parameter
     * will adapt to horizontal and vertical videos automatically. `0.0` indicates no
     * scaling (use the size of the image as-is), and `1.0 `fills the entire video.
     */
    scale?: number;
    /**
     * The size of the image in bytes.
     */
    size?: number;
    /**
     * The unique identifier for a watermark profile.
     */
    uid?: string;
    /**
     * The width of the image in pixels.
     */
    width?: number;
}
export type WatermarkDeleteResponse = string;
export interface WatermarkCreateParams {
    /**
     * Path param: The account identifier tag.
     */
    account_id: string;
    /**
     * Body param: The image file to upload.
     */
    file: string;
    /**
     * Body param: A short description of the watermark profile.
     */
    name?: string;
    /**
     * Body param: The translucency of the image. A value of `0.0` makes the image
     * completely transparent, and `1.0` makes the image completely opaque. Note that
     * if the image is already semi-transparent, setting this to `1.0` will not make
     * the image completely opaque.
     */
    opacity?: number;
    /**
     * Body param: The whitespace between the adjacent edges (determined by position)
     * of the video and the image. `0.0` indicates no padding, and `1.0` indicates a
     * fully padded video width or length, as determined by the algorithm.
     */
    padding?: number;
    /**
     * Body param: The location of the image. Valid positions are: `upperRight`,
     * `upperLeft`, `lowerLeft`, `lowerRight`, and `center`. Note that `center` ignores
     * the `padding` parameter.
     */
    position?: string;
    /**
     * Body param: The size of the image relative to the overall size of the video.
     * This parameter will adapt to horizontal and vertical videos automatically. `0.0`
     * indicates no scaling (use the size of the image as-is), and `1.0 `fills the
     * entire video.
     */
    scale?: number;
}
export interface WatermarkListParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface WatermarkDeleteParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export interface WatermarkGetParams {
    /**
     * The account identifier tag.
     */
    account_id: string;
}
export declare namespace Watermarks {
    export { type Watermark as Watermark, type WatermarkDeleteResponse as WatermarkDeleteResponse, WatermarksSinglePage as WatermarksSinglePage, type WatermarkCreateParams as WatermarkCreateParams, type WatermarkListParams as WatermarkListParams, type WatermarkDeleteParams as WatermarkDeleteParams, type WatermarkGetParams as WatermarkGetParams, };
}
//# sourceMappingURL=watermarks.d.ts.map