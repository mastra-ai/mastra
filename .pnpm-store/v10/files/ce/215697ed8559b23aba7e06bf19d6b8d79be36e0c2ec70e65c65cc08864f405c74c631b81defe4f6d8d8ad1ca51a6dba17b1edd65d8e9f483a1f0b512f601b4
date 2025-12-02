import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class UserAgents extends APIResource {
    /**
     * Retrieves the top user agents on robots.txt files.
     *
     * @example
     * ```ts
     * const response =
     *   await client.radar.robotsTXT.top.userAgents.directive();
     * ```
     */
    directive(query?: UserAgentDirectiveParams, options?: Core.RequestOptions): Core.APIPromise<UserAgentDirectiveResponse>;
    directive(options?: Core.RequestOptions): Core.APIPromise<UserAgentDirectiveResponse>;
}
export interface UserAgentDirectiveResponse {
    /**
     * Metadata for the results.
     */
    meta: UserAgentDirectiveResponse.Meta;
    top_0: Array<UserAgentDirectiveResponse.Top0>;
}
export declare namespace UserAgentDirectiveResponse {
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
        value: number;
        fully?: number;
        partially?: number;
    }
}
export interface UserAgentDirectiveParams {
    /**
     * Filters results by the specified array of dates.
     */
    date?: Array<string>;
    /**
     * Filters results by robots.txt directive.
     */
    directive?: 'ALLOW' | 'DISALLOW';
    /**
     * Filters results by domain category.
     */
    domainCategory?: Array<string>;
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
     * Filters results by user agent category.
     */
    userAgentCategory?: 'AI';
}
export declare namespace UserAgents {
    export { type UserAgentDirectiveResponse as UserAgentDirectiveResponse, type UserAgentDirectiveParams as UserAgentDirectiveParams, };
}
//# sourceMappingURL=user-agents.d.ts.map