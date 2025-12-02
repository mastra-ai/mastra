// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Traces extends APIResource {
  /**
   * Request Trace
   *
   * @example
   * ```ts
   * const trace = await client.requestTracers.traces.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   method: 'PUT',
   *   url: 'https://some.zone/some_path',
   *   body: { base64: 'c29tZV9yZXF1ZXN0X2JvZHk=' },
   *   context: {
   *     geoloc: { city: 'London' },
   *     skip_challenge: true,
   *   },
   *   cookies: {
   *     cookie_name_1: 'cookie_value_1',
   *     cookie_name_2: 'cookie_value_2',
   *   },
   *   headers: {
   *     header_name_1: 'header_value_1',
   *     header_name_2: 'header_value_2',
   *   },
   *   protocol: 'HTTP/1.1',
   * });
   * ```
   */
  create(params: TraceCreateParams, options?: Core.RequestOptions): Core.APIPromise<TraceCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/request-tracer/trace`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: TraceCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type Trace = Array<TraceItem>;

/**
 * List of steps acting on request/response
 */
export interface TraceItem {
  /**
   * If step type is rule, then action performed by this rule
   */
  action?: string;

  /**
   * If step type is rule, then action parameters of this rule as JSON
   */
  action_parameters?: unknown;

  /**
   * If step type is rule or ruleset, the description of this entity
   */
  description?: string;

  /**
   * If step type is rule, then expression used to match for this rule
   */
  expression?: string;

  /**
   * If step type is ruleset, then kind of this ruleset
   */
  kind?: string;

  /**
   * Whether tracing step affected tracing request/response
   */
  matched?: boolean;

  /**
   * If step type is ruleset, then name of this ruleset
   */
  name?: string;

  /**
   * Tracing step identifying name
   */
  step_name?: string;

  trace?: Trace;

  /**
   * Tracing step type
   */
  type?: string;
}

/**
 * Trace result with an origin status code
 */
export interface TraceCreateResponse {
  /**
   * HTTP Status code of zone response
   */
  status_code?: number;

  trace?: Trace;
}

export interface TraceCreateParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Body param: HTTP Method of tracing request
   */
  method: string;

  /**
   * Body param: URL to which perform tracing request
   */
  url: string;

  /**
   * Body param:
   */
  body?: TraceCreateParams.Body;

  /**
   * Body param: Additional request parameters
   */
  context?: TraceCreateParams.Context;

  /**
   * Body param: Cookies added to tracing request
   */
  cookies?: { [key: string]: string };

  /**
   * Body param: Headers added to tracing request
   */
  headers?: { [key: string]: string };

  /**
   * Body param: HTTP Protocol of tracing request
   */
  protocol?: string;

  /**
   * Body param: Skip sending the request to the Origin server after all rules
   * evaluation
   */
  skip_response?: boolean;
}

export namespace TraceCreateParams {
  export interface Body {
    /**
     * Base64 encoded request body
     */
    base64?: string;

    /**
     * Arbitrary json as request body
     */
    json?: unknown;

    /**
     * Request body as plain text
     */
    plain_text?: string;
  }

  /**
   * Additional request parameters
   */
  export interface Context {
    /**
     * Bot score used for evaluating tracing request processing
     */
    bot_score?: number;

    /**
     * Geodata for tracing request
     */
    geoloc?: Context.Geoloc;

    /**
     * Whether to skip any challenges for tracing request (e.g.: captcha)
     */
    skip_challenge?: boolean;

    /**
     * Threat score used for evaluating tracing request processing
     */
    threat_score?: number;
  }

  export namespace Context {
    /**
     * Geodata for tracing request
     */
    export interface Geoloc {
      city?: string;

      continent?: string;

      is_eu_country?: boolean;

      iso_code?: string;

      latitude?: number;

      longitude?: number;

      postal_code?: string;

      region_code?: string;

      subdivision_2_iso_code?: string;

      timezone?: string;
    }
  }
}

export declare namespace Traces {
  export {
    type Trace as Trace,
    type TraceItem as TraceItem,
    type TraceCreateResponse as TraceCreateResponse,
    type TraceCreateParams as TraceCreateParams,
  };
}
