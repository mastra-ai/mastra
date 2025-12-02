// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as StreamAPI from './stream';

export class Copy extends APIResource {
  /**
   * Uploads a video to Stream from a provided URL.
   *
   * @example
   * ```ts
   * const video = await client.stream.copy.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   url: 'https://example.com/myvideo.mp4',
   * });
   * ```
   */
  create(params: CopyCreateParams, options?: Core.RequestOptions): Core.APIPromise<StreamAPI.Video> {
    const { account_id, 'Upload-Creator': uploadCreator, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/stream/copy`, {
        body,
        ...options,
        headers: {
          ...(uploadCreator != null ? { 'Upload-Creator': uploadCreator } : undefined),
          ...options?.headers,
        },
      }) as Core.APIPromise<{ result: StreamAPI.Video }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface CopyCreateParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: A video's URL. The server must be publicly routable and support
   * `HTTP HEAD` requests and `HTTP GET` range requests. The server should respond to
   * `HTTP HEAD` requests with a `content-range` header that includes the size of the
   * file.
   */
  url: string;

  /**
   * Body param: Lists the origins allowed to display the video. Enter allowed origin
   * domains in an array and use `*` for wildcard subdomains. Empty arrays allow the
   * video to be viewed on any origin.
   */
  allowedOrigins?: Array<StreamAPI.AllowedOriginsParam>;

  /**
   * Body param: A user-defined identifier for the media creator.
   */
  creator?: string;

  /**
   * Body param: A user modifiable key-value store used to reference other systems of
   * record for managing videos.
   */
  meta?: unknown;

  /**
   * Body param: Indicates whether the video can be a accessed using the UID. When
   * set to `true`, a signed token must be generated with a signing key to view the
   * video.
   */
  requireSignedURLs?: boolean;

  /**
   * Body param: Indicates the date and time at which the video will be deleted. Omit
   * the field to indicate no change, or include with a `null` value to remove an
   * existing scheduled deletion. If specified, must be at least 30 days from upload
   * time.
   */
  scheduledDeletion?: string;

  /**
   * Body param: The timestamp for a thumbnail image calculated as a percentage value
   * of the video's duration. To convert from a second-wise timestamp to a
   * percentage, divide the desired timestamp by the total duration of the video. If
   * this value is not set, the default thumbnail image is taken from 0s of the
   * video.
   */
  thumbnailTimestampPct?: number;

  /**
   * Body param:
   */
  watermark?: CopyCreateParams.Watermark;

  /**
   * Header param: A user-defined identifier for the media creator.
   */
  'Upload-Creator'?: string;
}

export namespace CopyCreateParams {
  export interface Watermark {
    /**
     * The unique identifier for the watermark profile.
     */
    uid?: string;
  }
}

export declare namespace Copy {
  export { type CopyCreateParams as CopyCreateParams };
}
