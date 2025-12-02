// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Fallthrough extends APIResource {
  /**
   * Generate fallthrough WAF expression template from a set of API hosts
   *
   * @example
   * ```ts
   * const fallthrough =
   *   await client.apiGateway.expressionTemplate.fallthrough.create(
   *     {
   *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       hosts: ['{zone}.domain1.tld', 'domain2.tld'],
   *     },
   *   );
   * ```
   */
  create(
    params: FallthroughCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FallthroughCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/api_gateway/expression-template/fallthrough`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: FallthroughCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface FallthroughCreateResponse {
  /**
   * WAF Expression for fallthrough
   */
  expression: string;

  /**
   * Title for the expression
   */
  title: string;
}

export interface FallthroughCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: List of hosts to be targeted in the expression
   */
  hosts: Array<string>;
}

export declare namespace Fallthrough {
  export {
    type FallthroughCreateResponse as FallthroughCreateResponse,
    type FallthroughCreateParams as FallthroughCreateParams,
  };
}
