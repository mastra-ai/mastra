// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Variants extends APIResource {
  /**
   * Variant support enables caching variants of images with certain file extensions
   * in addition to the original. This only applies when the origin server sends the
   * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
   * does not serve the variant requested, the response will not be cached. This will
   * be indicated with BYPASS cache status in the response headers.
   *
   * @example
   * ```ts
   * const variant = await client.cache.variants.delete({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  delete(params: VariantDeleteParams, options?: Core.RequestOptions): Core.APIPromise<VariantDeleteResponse> {
    const { zone_id } = params;
    return (
      this._client.delete(`/zones/${zone_id}/cache/variants`, options) as Core.APIPromise<{
        result: VariantDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Variant support enables caching variants of images with certain file extensions
   * in addition to the original. This only applies when the origin server sends the
   * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
   * does not serve the variant requested, the response will not be cached. This will
   * be indicated with BYPASS cache status in the response headers.
   *
   * @example
   * ```ts
   * const response = await client.cache.variants.edit({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   value: {},
   * });
   * ```
   */
  edit(params: VariantEditParams, options?: Core.RequestOptions): Core.APIPromise<VariantEditResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/cache/variants`, { body, ...options }) as Core.APIPromise<{
        result: VariantEditResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Variant support enables caching variants of images with certain file extensions
   * in addition to the original. This only applies when the origin server sends the
   * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
   * does not serve the variant requested, the response will not be cached. This will
   * be indicated with BYPASS cache status in the response headers.
   *
   * @example
   * ```ts
   * const variant = await client.cache.variants.get({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: VariantGetParams, options?: Core.RequestOptions): Core.APIPromise<VariantGetResponse> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/cache/variants`, options) as Core.APIPromise<{
        result: VariantGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Variant support enables caching variants of images with certain file extensions
 * in addition to the original. This only applies when the origin server sends the
 * 'Vary: Accept' response header. If the origin server sends 'Vary: Accept' but
 * does not serve the variant requested, the response will not be cached. This will
 * be indicated with BYPASS cache status in the response headers.
 */
export interface CacheVariant {
  /**
   * ID of the zone setting.
   */
  id: 'variants';

  /**
   * Last time this setting was modified.
   */
  modified_on?: string | null;
}

export interface VariantDeleteResponse {
  /**
   * ID of the zone setting.
   */
  id: 'variants';

  /**
   * Whether the setting is editable
   */
  editable: boolean;

  /**
   * Last time this setting was modified.
   */
  modified_on?: string | null;
}

export interface VariantEditResponse {
  /**
   * ID of the zone setting.
   */
  id: 'variants';

  /**
   * Whether the setting is editable
   */
  editable: boolean;

  /**
   * The value of the feature
   */
  value: string;

  /**
   * Last time this setting was modified.
   */
  modified_on?: string | null;
}

export interface VariantGetResponse {
  /**
   * ID of the zone setting.
   */
  id: 'variants';

  /**
   * Whether the setting is editable
   */
  editable: boolean;

  /**
   * The value of the feature
   */
  value: string;

  /**
   * Last time this setting was modified.
   */
  modified_on?: string | null;
}

export interface VariantDeleteParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export interface VariantEditParams {
  /**
   * Path param: Identifier
   */
  zone_id: string;

  /**
   * Body param: Value of the zone setting.
   */
  value: VariantEditParams.Value;
}

export namespace VariantEditParams {
  /**
   * Value of the zone setting.
   */
  export interface Value {
    /**
     * List of strings with the MIME types of all the variants that should be served
     * for avif.
     */
    avif?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for bmp.
     */
    bmp?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for gif.
     */
    gif?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for jp2.
     */
    jp2?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for jpeg.
     */
    jpeg?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for jpg.
     */
    jpg?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for jpg2.
     */
    jpg2?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for png.
     */
    png?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for tif.
     */
    tif?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for tiff.
     */
    tiff?: Array<string>;

    /**
     * List of strings with the MIME types of all the variants that should be served
     * for webp.
     */
    webp?: Array<string>;
  }
}

export interface VariantGetParams {
  /**
   * Identifier
   */
  zone_id: string;
}

export declare namespace Variants {
  export {
    type CacheVariant as CacheVariant,
    type VariantDeleteResponse as VariantDeleteResponse,
    type VariantEditResponse as VariantEditResponse,
    type VariantGetResponse as VariantGetResponse,
    type VariantDeleteParams as VariantDeleteParams,
    type VariantEditParams as VariantEditParams,
    type VariantGetParams as VariantGetParams,
  };
}
