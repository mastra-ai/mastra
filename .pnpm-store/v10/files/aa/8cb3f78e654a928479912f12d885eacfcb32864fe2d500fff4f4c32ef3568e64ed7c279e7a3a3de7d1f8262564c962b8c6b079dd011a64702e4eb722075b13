// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Embed extends APIResource {
  /**
   * Fetches an HTML code snippet to embed a video in a web page delivered through
   * Cloudflare. On success, returns an HTML fragment for use on web pages to display
   * a video. On failure, returns a JSON response body.
   *
   * @example
   * ```ts
   * const embed = await client.stream.embed.get(
   *   'ea95132c15732412d22c1476fa83f27a',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(identifier: string, params: EmbedGetParams, options?: Core.RequestOptions): Core.APIPromise<string> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/stream/${identifier}/embed`, options);
  }
}

export type EmbedGetResponse = string;

export interface EmbedGetParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export declare namespace Embed {
  export { type EmbedGetResponse as EmbedGetResponse, type EmbedGetParams as EmbedGetParams };
}
