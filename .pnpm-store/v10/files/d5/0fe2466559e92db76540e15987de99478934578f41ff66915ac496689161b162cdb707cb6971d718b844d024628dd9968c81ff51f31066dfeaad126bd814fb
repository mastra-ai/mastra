// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Release extends APIResource {
  /**
   * Release messages from quarantine
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const releaseBulkResponse of client.emailSecurity.investigate.release.bulk(
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     body: ['4Njp3P0STMz2c02Q'],
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  bulk(
    params: ReleaseBulkParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ReleaseBulkResponsesSinglePage, ReleaseBulkResponse> {
    const { account_id, body } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/email-security/investigate/release`,
      ReleaseBulkResponsesSinglePage,
      { body: body, method: 'post', ...options },
    );
  }
}

export class ReleaseBulkResponsesSinglePage extends SinglePage<ReleaseBulkResponse> {}

export interface ReleaseBulkResponse {
  /**
   * The identifier of the message.
   */
  postfix_id: string;

  delivered?: Array<string> | null;

  failed?: Array<string> | null;

  undelivered?: Array<string> | null;
}

export interface ReleaseBulkParams {
  /**
   * Path param: Account Identifier
   */
  account_id: string;

  /**
   * Body param: A list of messages identfied by their `postfix_id`s that should be
   * released.
   */
  body: Array<string>;
}

Release.ReleaseBulkResponsesSinglePage = ReleaseBulkResponsesSinglePage;

export declare namespace Release {
  export {
    type ReleaseBulkResponse as ReleaseBulkResponse,
    ReleaseBulkResponsesSinglePage as ReleaseBulkResponsesSinglePage,
    type ReleaseBulkParams as ReleaseBulkParams,
  };
}
