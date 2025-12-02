// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Previews extends APIResource {
  /**
   * Get the result of a previous preview operation using the provided preview_id.
   *
   * @example
   * ```ts
   * const preview = await client.loadBalancers.previews.get(
   *   'p1aba936b94213e5b8dca0c0dbf1f9cc',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    previewId: string,
    params: PreviewGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PreviewGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/load_balancers/preview/${previewId}`,
        options,
      ) as Core.APIPromise<{ result: PreviewGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Resulting health data from a preview operation.
 */
export type PreviewGetResponse = { [key: string]: PreviewGetResponse.item };

export namespace PreviewGetResponse {
  export interface item {
    healthy?: boolean;

    origins?: Array<{ [key: string]: item.load_balancing_origin_health_data }>;
  }

  export namespace item {
    /**
     * The origin ipv4/ipv6 address or domain name mapped to it's health data.
     */
    export interface load_balancing_origin_health_data {
      failure_reason?: string;

      healthy?: boolean;

      response_code?: number;

      rtt?: string;
    }
  }
}

export interface PreviewGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

export declare namespace Previews {
  export { type PreviewGetResponse as PreviewGetResponse, type PreviewGetParams as PreviewGetParams };
}
