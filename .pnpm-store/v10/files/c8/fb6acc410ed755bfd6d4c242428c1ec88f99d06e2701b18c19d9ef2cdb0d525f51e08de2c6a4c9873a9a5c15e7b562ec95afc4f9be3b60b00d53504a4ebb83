// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { SinglePage } from '../../pagination';

export class Rules extends APIResource {
  /**
   * Put Rules
   */
  update(
    params: RuleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RuleUpdateResponsesSinglePage, RuleUpdateResponse> {
    const { zone_id, rules } = params ?? {};
    return this._client.getAPIList(`/zones/${zone_id}/cloud_connector/rules`, RuleUpdateResponsesSinglePage, {
      body: rules,
      method: 'put',
      ...options,
    });
  }

  /**
   * Rules
   */
  list(
    params: RuleListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<RuleListResponsesSinglePage, RuleListResponse> {
    const { zone_id } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/cloud_connector/rules`,
      RuleListResponsesSinglePage,
      options,
    );
  }
}

export class RuleUpdateResponsesSinglePage extends SinglePage<RuleUpdateResponse> {}

export class RuleListResponsesSinglePage extends SinglePage<RuleListResponse> {}

export interface RuleUpdateResponse {
  id?: string;

  description?: string;

  enabled?: boolean;

  expression?: string;

  /**
   * Parameters of Cloud Connector Rule
   */
  parameters?: RuleUpdateResponse.Parameters;

  /**
   * Cloud Provider type
   */
  provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
}

export namespace RuleUpdateResponse {
  /**
   * Parameters of Cloud Connector Rule
   */
  export interface Parameters {
    /**
     * Host to perform Cloud Connection to
     */
    host?: string;
  }
}

export interface RuleListResponse {
  id?: string;

  description?: string;

  enabled?: boolean;

  expression?: string;

  /**
   * Parameters of Cloud Connector Rule
   */
  parameters?: RuleListResponse.Parameters;

  /**
   * Cloud Provider type
   */
  provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
}

export namespace RuleListResponse {
  /**
   * Parameters of Cloud Connector Rule
   */
  export interface Parameters {
    /**
     * Host to perform Cloud Connection to
     */
    host?: string;
  }
}

export interface RuleUpdateParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param:
   */
  rules?: Array<RuleUpdateParams.Rule>;
}

export namespace RuleUpdateParams {
  export interface Rule {
    id?: string;

    description?: string;

    enabled?: boolean;

    expression?: string;

    /**
     * Parameters of Cloud Connector Rule
     */
    parameters?: Rule.Parameters;

    /**
     * Cloud Provider type
     */
    provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
  }

  export namespace Rule {
    /**
     * Parameters of Cloud Connector Rule
     */
    export interface Parameters {
      /**
       * Host to perform Cloud Connection to
       */
      host?: string;
    }
  }
}

export interface RuleListParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

Rules.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;

export declare namespace Rules {
  export {
    type RuleUpdateResponse as RuleUpdateResponse,
    type RuleListResponse as RuleListResponse,
    RuleUpdateResponsesSinglePage as RuleUpdateResponsesSinglePage,
    RuleListResponsesSinglePage as RuleListResponsesSinglePage,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
  };
}
