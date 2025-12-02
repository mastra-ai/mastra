// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Downloads extends APIResource {
  /**
   * Download indicator feed data
   *
   * @example
   * ```ts
   * const download =
   *   await client.intel.indicatorFeeds.downloads.get(12, {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(
    feedId: number,
    params: DownloadGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DownloadGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/intel/indicator_feeds/${feedId}/download`,
        options,
      ) as Core.APIPromise<{ result: DownloadGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface DownloadGetResponse {
  /**
   * Feed id
   */
  file_id?: number;

  /**
   * Name of the file unified in our system
   */
  filename?: string;

  /**
   * Current status of upload, should be unified
   */
  status?: string;
}

export interface DownloadGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

export declare namespace Downloads {
  export { type DownloadGetResponse as DownloadGetResponse, type DownloadGetParams as DownloadGetParams };
}
