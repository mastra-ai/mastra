// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Variants extends APIResource {
  /**
   * Specify variants that allow you to resize images for different use cases.
   *
   * @example
   * ```ts
   * const variant = await client.images.v1.variants.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   id: 'hero',
   *   options: {
   *     fit: 'scale-down',
   *     height: 768,
   *     metadata: 'none',
   *     width: 1366,
   *   },
   * });
   * ```
   */
  create(params: VariantCreateParams, options?: Core.RequestOptions): Core.APIPromise<VariantCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/images/v1/variants`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: VariantCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Lists existing variants.
   *
   * @example
   * ```ts
   * const variant = await client.images.v1.variants.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  list(params: VariantListParams, options?: Core.RequestOptions): Core.APIPromise<Variant> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/images/v1/variants`, options) as Core.APIPromise<{
        result: Variant;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deleting a variant purges the cache for all images associated with the variant.
   *
   * @example
   * ```ts
   * const variant = await client.images.v1.variants.delete(
   *   'hero',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    variantId: string,
    params: VariantDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VariantDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/images/v1/variants/${variantId}`,
        options,
      ) as Core.APIPromise<{ result: VariantDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updating a variant purges the cache for all images associated with the variant.
   *
   * @example
   * ```ts
   * const response = await client.images.v1.variants.edit(
   *   'hero',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     options: {
   *       fit: 'scale-down',
   *       height: 768,
   *       metadata: 'none',
   *       width: 1366,
   *     },
   *   },
   * );
   * ```
   */
  edit(
    variantId: string,
    params: VariantEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VariantEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/images/v1/variants/${variantId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: VariantEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch details for a single variant.
   *
   * @example
   * ```ts
   * const variant = await client.images.v1.variants.get(
   *   'hero',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    variantId: string,
    params: VariantGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VariantGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/images/v1/variants/${variantId}`,
        options,
      ) as Core.APIPromise<{ result: VariantGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface Variant {
  variants?: Variant.Variants;
}

export namespace Variant {
  export interface Variants {
    hero?: Variants.Hero;
  }

  export namespace Variants {
    export interface Hero {
      id: string;

      /**
       * Allows you to define image resizing sizes for different use cases.
       */
      options: Hero.Options;

      /**
       * Indicates whether the variant can access an image without a signature,
       * regardless of image access control.
       */
      neverRequireSignedURLs?: boolean;
    }

    export namespace Hero {
      /**
       * Allows you to define image resizing sizes for different use cases.
       */
      export interface Options {
        /**
         * The fit property describes how the width and height dimensions should be
         * interpreted.
         */
        fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

        /**
         * Maximum height in image pixels.
         */
        height: number;

        /**
         * What EXIF data should be preserved in the output image.
         */
        metadata: 'keep' | 'copyright' | 'none';

        /**
         * Maximum width in image pixels.
         */
        width: number;
      }
    }
  }
}

export interface VariantCreateResponse {
  variant?: VariantCreateResponse.Variant;
}

export namespace VariantCreateResponse {
  export interface Variant {
    id: string;

    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    options: Variant.Options;

    /**
     * Indicates whether the variant can access an image without a signature,
     * regardless of image access control.
     */
    neverRequireSignedURLs?: boolean;
  }

  export namespace Variant {
    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    export interface Options {
      /**
       * The fit property describes how the width and height dimensions should be
       * interpreted.
       */
      fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

      /**
       * Maximum height in image pixels.
       */
      height: number;

      /**
       * What EXIF data should be preserved in the output image.
       */
      metadata: 'keep' | 'copyright' | 'none';

      /**
       * Maximum width in image pixels.
       */
      width: number;
    }
  }
}

export type VariantDeleteResponse = unknown | string;

export interface VariantEditResponse {
  variant?: VariantEditResponse.Variant;
}

export namespace VariantEditResponse {
  export interface Variant {
    id: string;

    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    options: Variant.Options;

    /**
     * Indicates whether the variant can access an image without a signature,
     * regardless of image access control.
     */
    neverRequireSignedURLs?: boolean;
  }

  export namespace Variant {
    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    export interface Options {
      /**
       * The fit property describes how the width and height dimensions should be
       * interpreted.
       */
      fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

      /**
       * Maximum height in image pixels.
       */
      height: number;

      /**
       * What EXIF data should be preserved in the output image.
       */
      metadata: 'keep' | 'copyright' | 'none';

      /**
       * Maximum width in image pixels.
       */
      width: number;
    }
  }
}

export interface VariantGetResponse {
  variant?: VariantGetResponse.Variant;
}

export namespace VariantGetResponse {
  export interface Variant {
    id: string;

    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    options: Variant.Options;

    /**
     * Indicates whether the variant can access an image without a signature,
     * regardless of image access control.
     */
    neverRequireSignedURLs?: boolean;
  }

  export namespace Variant {
    /**
     * Allows you to define image resizing sizes for different use cases.
     */
    export interface Options {
      /**
       * The fit property describes how the width and height dimensions should be
       * interpreted.
       */
      fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

      /**
       * Maximum height in image pixels.
       */
      height: number;

      /**
       * What EXIF data should be preserved in the output image.
       */
      metadata: 'keep' | 'copyright' | 'none';

      /**
       * Maximum width in image pixels.
       */
      width: number;
    }
  }
}

export interface VariantCreateParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param:
   */
  id: string;

  /**
   * Body param: Allows you to define image resizing sizes for different use cases.
   */
  options: VariantCreateParams.Options;

  /**
   * Body param: Indicates whether the variant can access an image without a
   * signature, regardless of image access control.
   */
  neverRequireSignedURLs?: boolean;
}

export namespace VariantCreateParams {
  /**
   * Allows you to define image resizing sizes for different use cases.
   */
  export interface Options {
    /**
     * The fit property describes how the width and height dimensions should be
     * interpreted.
     */
    fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

    /**
     * Maximum height in image pixels.
     */
    height: number;

    /**
     * What EXIF data should be preserved in the output image.
     */
    metadata: 'keep' | 'copyright' | 'none';

    /**
     * Maximum width in image pixels.
     */
    width: number;
  }
}

export interface VariantListParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export interface VariantDeleteParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export interface VariantEditParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param: Allows you to define image resizing sizes for different use cases.
   */
  options: VariantEditParams.Options;

  /**
   * Body param: Indicates whether the variant can access an image without a
   * signature, regardless of image access control.
   */
  neverRequireSignedURLs?: boolean;
}

export namespace VariantEditParams {
  /**
   * Allows you to define image resizing sizes for different use cases.
   */
  export interface Options {
    /**
     * The fit property describes how the width and height dimensions should be
     * interpreted.
     */
    fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

    /**
     * Maximum height in image pixels.
     */
    height: number;

    /**
     * What EXIF data should be preserved in the output image.
     */
    metadata: 'keep' | 'copyright' | 'none';

    /**
     * Maximum width in image pixels.
     */
    width: number;
  }
}

export interface VariantGetParams {
  /**
   * Account identifier tag.
   */
  account_id: string;
}

export declare namespace Variants {
  export {
    type Variant as Variant,
    type VariantCreateResponse as VariantCreateResponse,
    type VariantDeleteResponse as VariantDeleteResponse,
    type VariantEditResponse as VariantEditResponse,
    type VariantGetResponse as VariantGetResponse,
    type VariantCreateParams as VariantCreateParams,
    type VariantListParams as VariantListParams,
    type VariantDeleteParams as VariantDeleteParams,
    type VariantEditParams as VariantEditParams,
    type VariantGetParams as VariantGetParams,
  };
}
