// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Metrics extends APIResource {
  /**
   * Get Storage/Object Count Metrics across all buckets in your account. Note that
   * Account-Level Metrics may not immediately reflect the latest data.
   *
   * @example
   * ```ts
   * const metrics = await client.r2.buckets.metrics.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  list(params: MetricListParams, options?: Core.RequestOptions): Core.APIPromise<MetricListResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/r2/metrics`, options) as Core.APIPromise<{
        result: MetricListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

/**
 * Metrics based on the class they belong to.
 */
export interface MetricListResponse {
  /**
   * Metrics based on what state they are in(uploaded or published).
   */
  infrequentAccess?: MetricListResponse.InfrequentAccess;

  /**
   * Metrics based on what state they are in(uploaded or published).
   */
  standard?: MetricListResponse.Standard;
}

export namespace MetricListResponse {
  /**
   * Metrics based on what state they are in(uploaded or published).
   */
  export interface InfrequentAccess {
    /**
     * Metrics on number of objects/amount of storage used.
     */
    published?: InfrequentAccess.Published;

    /**
     * Metrics on number of objects/amount of storage used.
     */
    uploaded?: InfrequentAccess.Uploaded;
  }

  export namespace InfrequentAccess {
    /**
     * Metrics on number of objects/amount of storage used.
     */
    export interface Published {
      /**
       * Amount of.
       */
      metadataSize?: number;

      /**
       * Number of objects stored.
       */
      objects?: number;

      /**
       * Amount of storage used by object data.
       */
      payloadSize?: number;
    }

    /**
     * Metrics on number of objects/amount of storage used.
     */
    export interface Uploaded {
      /**
       * Amount of.
       */
      metadataSize?: number;

      /**
       * Number of objects stored.
       */
      objects?: number;

      /**
       * Amount of storage used by object data.
       */
      payloadSize?: number;
    }
  }

  /**
   * Metrics based on what state they are in(uploaded or published).
   */
  export interface Standard {
    /**
     * Metrics on number of objects/amount of storage used.
     */
    published?: Standard.Published;

    /**
     * Metrics on number of objects/amount of storage used.
     */
    uploaded?: Standard.Uploaded;
  }

  export namespace Standard {
    /**
     * Metrics on number of objects/amount of storage used.
     */
    export interface Published {
      /**
       * Amount of.
       */
      metadataSize?: number;

      /**
       * Number of objects stored.
       */
      objects?: number;

      /**
       * Amount of storage used by object data.
       */
      payloadSize?: number;
    }

    /**
     * Metrics on number of objects/amount of storage used.
     */
    export interface Uploaded {
      /**
       * Amount of.
       */
      metadataSize?: number;

      /**
       * Number of objects stored.
       */
      objects?: number;

      /**
       * Amount of storage used by object data.
       */
      payloadSize?: number;
    }
  }
}

export interface MetricListParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace Metrics {
  export { type MetricListResponse as MetricListResponse, type MetricListParams as MetricListParams };
}
