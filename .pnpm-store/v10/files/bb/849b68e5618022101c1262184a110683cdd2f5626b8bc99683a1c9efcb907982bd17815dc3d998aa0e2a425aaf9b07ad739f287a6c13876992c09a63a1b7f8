// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Bulks extends APIResource {
  /**
   * Same as summary.
   *
   * @example
   * ```ts
   * const bulks = await client.intel.domains.bulks.get({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: BulkGetParams, options?: Core.RequestOptions): Core.APIPromise<BulkGetResponse | null> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/intel/domain/bulk`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: BulkGetResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type BulkGetResponse = Array<BulkGetResponse.BulkGetResponseItem>;

export namespace BulkGetResponse {
  export interface BulkGetResponseItem {
    /**
     * Additional information related to the host name.
     */
    additional_information?: BulkGetResponseItem.AdditionalInformation;

    /**
     * Application that the hostname belongs to.
     */
    application?: BulkGetResponseItem.Application;

    content_categories?: Array<BulkGetResponseItem.ContentCategory>;

    domain?: string;

    inherited_content_categories?: Array<BulkGetResponseItem.InheritedContentCategory>;

    /**
     * Domain from which `inherited_content_categories` and `inherited_risk_types` are
     * inherited, if applicable.
     */
    inherited_from?: string;

    inherited_risk_types?: Array<BulkGetResponseItem.InheritedRiskType>;

    /**
     * Global Cloudflare 100k ranking for the last 30 days, if available for the
     * hostname. The top ranked domain is 1, the lowest ranked domain is 100,000.
     */
    popularity_rank?: number;

    /**
     * Hostname risk score, which is a value between 0 (lowest risk) to 1 (highest
     * risk).
     */
    risk_score?: number;

    risk_types?: Array<BulkGetResponseItem.RiskType>;
  }

  export namespace BulkGetResponseItem {
    /**
     * Additional information related to the host name.
     */
    export interface AdditionalInformation {
      /**
       * Suspected DGA malware family.
       */
      suspected_malware_family?: string;
    }

    /**
     * Application that the hostname belongs to.
     */
    export interface Application {
      id?: number;

      name?: string;
    }

    /**
     * Current content categories.
     */
    export interface ContentCategory {
      id?: number;

      name?: string;

      super_category_id?: number;
    }

    export interface InheritedContentCategory {
      id?: number;

      name?: string;

      super_category_id?: number;
    }

    export interface InheritedRiskType {
      id?: number;

      name?: string;

      super_category_id?: number;
    }

    export interface RiskType {
      id?: number;

      name?: string;

      super_category_id?: number;
    }
  }
}

export interface BulkGetParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: Accepts multiple values like
   * `?domain=cloudflare.com&domain=example.com`.
   */
  domain?: Array<string>;
}

export declare namespace Bulks {
  export { type BulkGetResponse as BulkGetResponse, type BulkGetParams as BulkGetParams };
}
