// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class URLs extends APIResource {
  /**
   * Get Gateway URL
   *
   * @example
   * ```ts
   * const url = await client.aiGateway.urls.get(
   *   'my-gateway',
   *   'workers-ai',
   *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
   * );
   * ```
   */
  get(
    gatewayId: string,
    provider: string,
    params: URLGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<URLGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/url/${provider}`,
        options,
      ) as Core.APIPromise<{ result: URLGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type URLGetResponse = string;

export interface URLGetParams {
  account_id: string;
}

export declare namespace URLs {
  export { type URLGetResponse as URLGetResponse, type URLGetParams as URLGetParams };
}
