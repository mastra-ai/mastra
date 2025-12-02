import { APIResource } from "../../../../../../resource.js";
import * as Core from "../../../../../../core.js";
export declare class Spoof extends APIResource {
    /**
     * Retrieves the top TLDs by emails classified as spoof or not.
     *
     * @example
     * ```ts
     * const spoof =
     *   await client.radar.email.security.top.tlds.spoof.get(
     *     'SPOOF',
     *   );
     * ```
     */
    get(spoof: 'SPOOF' | 'NOT_SPOOF', query?: SpoofGetParams, options?: Core.RequestOptions): Core.APIPromise<SpoofGetResponse>;
    get(spoof: 'SPOOF' | 'NOT_SPOOF', options?: Core.RequestOptions): Core.APIPromise<SpoofGetResponse>;
}
export interface SpoofGetResponse {
    /**
     * Metadata for the results.
     */
    meta: SpoofGetResponse.Meta;
    top_0: Array<SpoofGetResponse.Top0>;
}
export declare namespace SpoofGetResponse {
    /**
     * Metadata for the results.
     */
    interface Meta {
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
        normalization: 'PERCENTAGE' | 'MIN0_MAX' | 'MIN_MAX' | 'RAW_VALUES' | 'PERCENTAGE_CHANGE' | 'ROLLING_AVERAGE' | 'OVERLAPPED_PERCENTAGE' | 'RATIO';
        /**
         * Measurement units for the results.
         */
        units: Array<Meta.Unit>;
    }
    namespace Meta {
        interface ConfidenceInfo {
            annotations: Array<ConfidenceInfo.Annotation>;
            /**
             * Provides an indication of how much confidence Cloudflare has in the data.
             */
            level: number;
        }
        namespace ConfidenceInfo {
            /**
             * Annotation associated with the result (e.g. outage or other type of event).
             */
            interface Annotation {
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
        interface DateRange {
            /**
             * Adjusted end of date range.
             */
            endTime: string;
            /**
             * Adjusted start of date range.
             */
            startTime: string;
        }
        interface Unit {
            name: string;
            value: string;
        }
    }
    interface Top0 {
        name: string;
        /**
         * A numeric string.
         */
        value: string;
    }
}
export interface SpoofGetParams {
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
export declare namespace Spoof {
    export { type SpoofGetResponse as SpoofGetResponse, type SpoofGetParams as SpoofGetParams };
}
//# sourceMappingURL=spoof.d.ts.map