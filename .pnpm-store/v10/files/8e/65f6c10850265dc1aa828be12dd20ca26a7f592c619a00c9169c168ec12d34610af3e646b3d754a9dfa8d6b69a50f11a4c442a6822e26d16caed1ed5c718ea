// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

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
  create(
    params: DirectUploadCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DirectUploadCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/images/v2/direct_upload`,
        Core.multipartFormRequestOptions({ body, ...options }),
      ) as Core.APIPromise<{ result: DirectUploadCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface DirectUploadCreateResponse {
  /**
   * Image unique identifier.
   */
  id?: string;

  /**
   * The URL the unauthenticated upload can be performed to using a single HTTP POST
   * (multipart/form-data) request.
   */
  uploadURL?: string;
}

export interface DirectUploadCreateParams {
  /**
   * Path param: Account identifier tag.
   */
  account_id: string;

  /**
   * Body param: Optional Image Custom ID. Up to 1024 chars. Can include any number
   * of subpaths, and utf8 characters. Cannot start nor end with a / (forward slash).
   * Cannot be a UUID.
   */
  id?: string;

  /**
   * Body param: The date after which the upload will not be accepted. Minimum: Now +
   * 2 minutes. Maximum: Now + 6 hours.
   */
  expiry?: string;

  /**
   * Body param: User modifiable key-value store. Can be used for keeping references
   * to another system of record, for managing images.
   */
  metadata?: unknown;

  /**
   * Body param: Indicates whether the image requires a signature token to be
   * accessed.
   */
  requireSignedURLs?: boolean;
}

export declare namespace DirectUploads {
  export {
    type DirectUploadCreateResponse as DirectUploadCreateResponse,
    type DirectUploadCreateParams as DirectUploadCreateParams,
  };
}
