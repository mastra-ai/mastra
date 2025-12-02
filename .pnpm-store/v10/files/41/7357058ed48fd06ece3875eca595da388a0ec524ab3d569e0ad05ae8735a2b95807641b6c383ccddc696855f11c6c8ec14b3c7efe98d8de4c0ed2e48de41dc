// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Colos extends APIResource {
  /**
   * List Cloudflare colos that account's devices were connected to during a time
   * period, sorted by usage starting from the most used colo. Colos without traffic
   * are also returned and sorted alphabetically.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const coloListResponse of client.zeroTrust.dex.colos.list(
   *   {
   *     account_id: '01a7362d577a6c3019a474fd6f485823',
   *     from: '2023-08-20T20:45:00Z',
   *     to: '2023-08-24T20:45:00Z',
   *   },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: ColoListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ColoListResponsesSinglePage, ColoListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(`/accounts/${account_id}/dex/colos`, ColoListResponsesSinglePage, {
      query,
      ...options,
    });
  }
}

export class ColoListResponsesSinglePage extends SinglePage<ColoListResponse> {}

export type ColoListResponse = unknown;

export interface ColoListParams {
  /**
   * Path param: unique identifier linked to an account in the API request path.
   */
  account_id: string;

  /**
   * Query param: Start time for connection period in ISO (RFC3339 - ISO 8601) format
   */
  from: string;

  /**
   * Query param: End time for connection period in ISO (RFC3339 - ISO 8601) format
   */
  to: string;

  /**
   * Query param: Type of usage that colos should be sorted by. If unspecified,
   * returns all Cloudflare colos sorted alphabetically.
   */
  sortBy?: 'fleet-status-usage' | 'application-tests-usage';
}

Colos.ColoListResponsesSinglePage = ColoListResponsesSinglePage;

export declare namespace Colos {
  export {
    type ColoListResponse as ColoListResponse,
    ColoListResponsesSinglePage as ColoListResponsesSinglePage,
    type ColoListParams as ColoListParams,
  };
}
