// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as CustomHostnamesAPI from '../custom-hostnames/custom-hostnames';

export class Analyze extends APIResource {
  /**
   * Returns the set of hostnames, the signature algorithm, and the expiration date
   * of the certificate.
   *
   * @example
   * ```ts
   * const analyze = await client.ssl.analyze.create({
   *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  create(params: AnalyzeCreateParams, options?: Core.RequestOptions): Core.APIPromise<AnalyzeCreateResponse> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(`/zones/${zone_id}/ssl/analyze`, { body, ...options }) as Core.APIPromise<{
        result: AnalyzeCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type AnalyzeCreateResponse = unknown;

export interface AnalyzeCreateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: A ubiquitous bundle has the highest probability of being verified
   * everywhere, even by clients using outdated or unusual trust stores. An optimal
   * bundle uses the shortest chain and newest intermediates. And the force bundle
   * verifies the chain, but does not otherwise modify it.
   */
  bundle_method?: CustomHostnamesAPI.BundleMethodParam;

  /**
   * Body param: The zone's SSL certificate or certificate and the intermediate(s).
   */
  certificate?: string;
}

export declare namespace Analyze {
  export {
    type AnalyzeCreateResponse as AnalyzeCreateResponse,
    type AnalyzeCreateParams as AnalyzeCreateParams,
  };
}
