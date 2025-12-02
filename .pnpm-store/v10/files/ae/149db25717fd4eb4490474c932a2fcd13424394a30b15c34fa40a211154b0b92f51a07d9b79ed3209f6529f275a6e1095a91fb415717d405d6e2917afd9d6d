// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../../resource';
import { isRequestOptions } from '../../../../../../core';
import * as Core from '../../../../../../core';

export class Spam extends APIResource {
  /**
   * Retrieves the top TLDs by emails classified as spam or not.
   *
   * @example
   * ```ts
   * const spam =
   *   await client.radar.email.security.top.tlds.spam.get(
   *     'SPAM',
   *   );
   * ```
   */
  get(
    spam: 'SPAM' | 'NOT_SPAM',
    query?: SpamGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SpamGetResponse>;
  get(spam: 'SPAM' | 'NOT_SPAM', options?: Core.RequestOptions): Core.APIPromise<SpamGetResponse>;
  get(
    spam: 'SPAM' | 'NOT_SPAM',
    query: SpamGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<SpamGetResponse> {
    if (isRequestOptions(query)) {
      return this.get(spam, {}, query);
    }
    return (
      this._client.get(`/radar/email/security/top/tlds/spam/${spam}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: SpamGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface SpamGetResponse {
  /**
   * Metadata for the results.
   */
  meta: SpamGetResponse.Meta;

  top_0: Array<SpamGetResponse.Top0>;
}

export namespace SpamGetResponse {
  /**
   * Metadata for the results.
   */
  export interface Meta {
    confidenceInfo: Meta.ConfidenceInfo | null;

    dateRange: Array<Meta.DateRange>;

    /**
     * Timestamp of the last dataset update.
     */
    lastUpdated: string;

    /**
     * Normalization method applied to the results. Refer to
     * [Normalization methods](https://developers.cloudflare.com/radar/concepts/normalization/).
     */
    normalization:
      | 'PERCENTAGE'
      | 'MIN0_MAX'
      | 'MIN_MAX'
      | 'RAW_VALUES'
      | 'PERCENTAGE_CHANGE'
      | 'ROLLING_AVERAGE'
      | 'OVERLAPPED_PERCENTAGE'
      | 'RATIO';

    /**
     * Measurement units for the results.
     */
    units: Array<Meta.Unit>;
  }

  export namespace Meta {
    export interface ConfidenceInfo {
      annotations: Array<ConfidenceInfo.Annotation>;

      /**
       * Provides an indication of how much confidence Cloudflare has in the data.
       */
      level: number;
    }

    export namespace ConfidenceInfo {
      /**
       * Annotation associated with the result (e.g. outage or other type of event).
       */
      export interface Annotation {
        dataSource: string;

        description: string;

        endDate: string;

        eventType: string;

        /**
         * Whether event is a single point in time or a time range.
         */
        isInstantaneous: boolean;

        linkedUrl: string;

        startDate: string;
      }
    }

    export interface DateRange {
      /**
       * Adjusted end of date range.
       */
      endTime: string;

      /**
       * Adjusted start of date range.
       */
      startTime: string;
    }

    export interface Unit {
      name: string;

      value: string;
    }
  }

  export interface Top0 {
    name: string;

    /**
     * A numeric string.
     */
    value: string;
  }
}

export interface SpamGetParams {
  /**
   * Filters results by ARC (Authenticated Received Chain) validation.
   */
  arc?: Array<'PASS' | 'NONE' | 'FAIL'>;

  /**
   * End of the date range (inclusive).
   */
  dateEnd?: Array<string>;

  /**
   * Filters results by date range. For example, use `7d` and `7dcontrol` to compare
   * this week with the previous week. Use this parameter or set specific start and
   * end dates (`dateStart` and `dateEnd` parameters).
   */
  dateRange?: Array<string>;

  /**
   * Start of the date range.
   */
  dateStart?: Array<string>;

  /**
   * Filters results by DKIM (DomainKeys Identified Mail) validation status.
   */
  dkim?: Array<'PASS' | 'NONE' | 'FAIL'>;

  /**
   * Filters results by DMARC (Domain-based Message Authentication, Reporting and
   * Conformance) validation status.
   */
  dmarc?: Array<'PASS' | 'NONE' | 'FAIL'>;

  /**
   * Format in which results will be returned.
   */
  format?: 'JSON' | 'CSV';

  /**
   * Limits the number of objects returned in the response.
   */
  limit?: number;

  /**
   * Array of names used to label the series in the response.
   */
  name?: Array<string>;

  /**
   * Filters results by SPF (Sender Policy Framework) validation status.
   */
  spf?: Array<'PASS' | 'NONE' | 'FAIL'>;

  /**
   * Filters results by TLD category.
   */
  tldCategory?: 'CLASSIC' | 'COUNTRY';

  /**
   * Filters results by TLS version.
   */
  tlsVersion?: Array<'TLSv1_0' | 'TLSv1_1' | 'TLSv1_2' | 'TLSv1_3'>;
}

export declare namespace Spam {
  export { type SpamGetResponse as SpamGetResponse, type SpamGetParams as SpamGetParams };
}
