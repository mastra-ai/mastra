import { APIResource } from "../../../../../../resource.js";
import * as Core from "../../../../../../core.js";
import * as MaliciousAPI from "./malicious.js";
import { Malicious, MaliciousGetParams, MaliciousGetResponse } from "./malicious.js";
import * as SpamAPI from "./spam.js";
import { Spam, SpamGetParams, SpamGetResponse } from "./spam.js";
import * as SpoofAPI from "./spoof.js";
import { Spoof, SpoofGetParams, SpoofGetResponse } from "./spoof.js";
export declare class Tlds extends APIResource {
    malicious: MaliciousAPI.Malicious;
    spam: SpamAPI.Spam;
    spoof: SpoofAPI.Spoof;
    /**
     * Retrieves the top TLDs by number of email messages.
     *
     * @example
     * ```ts
     * const tld =
     *   await client.radar.email.security.top.tlds.get();
     * ```
     */
    get(query?: TldGetParams, options?: Core.RequestOptions): Core.APIPromise<TldGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<TldGetResponse>;
}
export interface TldGetResponse {
    /**
     * Metadata for the results.
     */
    meta: TldGetResponse.Meta;
    top_0: Array<TldGetResponse.Top0>;
}
export declare namespace TldGetResponse {
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
export interface TldGetParams {
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
export declare namespace Tlds {
    export { type TldGetResponse as TldGetResponse, type TldGetParams as TldGetParams };
    export { Malicious as Malicious, type MaliciousGetResponse as MaliciousGetResponse, type MaliciousGetParams as MaliciousGetParams, };
    export { Spam as Spam, type SpamGetResponse as SpamGetResponse, type SpamGetParams as SpamGetParams };
    export { Spoof as Spoof, type SpoofGetResponse as SpoofGetResponse, type SpoofGetParams as SpoofGetParams };
}
//# sourceMappingURL=tlds.d.ts.map