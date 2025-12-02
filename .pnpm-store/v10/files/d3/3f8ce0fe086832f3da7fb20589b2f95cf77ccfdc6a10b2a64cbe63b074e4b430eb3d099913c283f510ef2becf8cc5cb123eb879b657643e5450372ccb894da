import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as WebCrawlersAPI from "./web-crawlers.js";
import { WebCrawlerSummaryParams, WebCrawlerSummaryResponse, WebCrawlerTimeseriesGroupsParams, WebCrawlerTimeseriesGroupsResponse, WebCrawlers } from "./web-crawlers.js";
export declare class Bots extends APIResource {
    webCrawlers: WebCrawlersAPI.WebCrawlers;
    /**
     * Retrieves a list of bots.
     *
     * @example
     * ```ts
     * const bots = await client.radar.bots.list();
     * ```
     */
    list(query?: BotListParams, options?: Core.RequestOptions): Core.APIPromise<BotListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<BotListResponse>;
    /**
     * Retrieves the requested bot information.
     *
     * @example
     * ```ts
     * const bot = await client.radar.bots.get('gptbot');
     * ```
     */
    get(botSlug: string, query?: BotGetParams, options?: Core.RequestOptions): Core.APIPromise<BotGetResponse>;
    get(botSlug: string, options?: Core.RequestOptions): Core.APIPromise<BotGetResponse>;
    /**
     * Retrieves an aggregated summary of bots HTTP requests grouped by the specified
     * dimension.
     *
     * @example
     * ```ts
     * const response = await client.radar.bots.summary('BOT');
     * ```
     */
    summary(dimension: 'BOT' | 'BOT_OPERATOR' | 'BOT_CATEGORY', query?: BotSummaryParams, options?: Core.RequestOptions): Core.APIPromise<BotSummaryResponse>;
    summary(dimension: 'BOT' | 'BOT_OPERATOR' | 'BOT_CATEGORY', options?: Core.RequestOptions): Core.APIPromise<BotSummaryResponse>;
    /**
     * Retrieves bots HTTP request volume over time.
     *
     * @example
     * ```ts
     * const response = await client.radar.bots.timeseries();
     * ```
     */
    timeseries(query?: BotTimeseriesParams, options?: Core.RequestOptions): Core.APIPromise<BotTimeseriesResponse>;
    timeseries(options?: Core.RequestOptions): Core.APIPromise<BotTimeseriesResponse>;
    /**
     * Retrieves the distribution of HTTP requests from bots, grouped by chosen the
     * specified dimension over time.
     *
     * @example
     * ```ts
     * const response = await client.radar.bots.timeseriesGroups(
     *   'BOT',
     * );
     * ```
     */
    timeseriesGroups(dimension: 'BOT' | 'BOT_OPERATOR' | 'BOT_CATEGORY', query?: BotTimeseriesGroupsParams, options?: Core.RequestOptions): Core.APIPromise<BotTimeseriesGroupsResponse>;
    timeseriesGroups(dimension: 'BOT' | 'BOT_OPERATOR' | 'BOT_CATEGORY', options?: Core.RequestOptions): Core.APIPromise<BotTimeseriesGroupsResponse>;
}
export interface BotListResponse {
    bots: Array<BotListResponse.Bot>;
}
export declare namespace BotListResponse {
    interface Bot {
        /**
         * The category of the bot.
         */
        category: string;
        /**
         * A summary for the bot (e.g., purpose).
         */
        description: string;
        /**
         * The name of the bot.
         */
        name: string;
        /**
         * The organization that owns and operates the bot.
         */
        operator: string;
        /**
         * A kebab-case identifier derived from the bot name.
         */
        slug: string;
    }
}
export interface BotGetResponse {
    bot: BotGetResponse.Bot;
}
export declare namespace BotGetResponse {
    interface Bot {
        /**
         * The category of the bot.
         */
        category: string;
        /**
         * A summary for the bot (e.g., purpose).
         */
        description: string;
        /**
         * The name of the bot.
         */
        name: string;
        /**
         * The organization that owns and operates the bot.
         */
        operator: string;
        /**
         * The link to the bot documentation.
         */
        operatorUrl: string;
        /**
         * A kebab-case identifier derived from the bot name.
         */
        slug: string;
        userAgentPatterns: Array<string>;
        userAgents: Array<string>;
    }
}
export interface BotSummaryResponse {
    /**
     * Metadata for the results.
     */
    meta: BotSummaryResponse.Meta;
    summary_0: {
        [key: string]: string;
    };
}
export declare namespace BotSummaryResponse {
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
}
export interface BotTimeseriesResponse {
    /**
     * Metadata for the results.
     */
    meta: BotTimeseriesResponse.Meta;
    [k: string]: BotTimeseriesResponse.unnamed_schema_ref_75bae70cf28e6bcef364b9840db3bdeb | BotTimeseriesResponse.Meta | undefined;
}
export declare namespace BotTimeseriesResponse {
    /**
     * Metadata for the results.
     */
    interface Meta {
        /**
         * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
         * Refer to
         * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
         */
        aggInterval: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'ONE_DAY' | 'ONE_WEEK' | 'ONE_MONTH';
        confidenceInfo: Meta.ConfidenceInfo;
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
    interface unnamed_schema_ref_75bae70cf28e6bcef364b9840db3bdeb {
        timestamps: Array<string>;
        values: Array<string>;
    }
}
export interface BotTimeseriesGroupsResponse {
    /**
     * Metadata for the results.
     */
    meta: BotTimeseriesGroupsResponse.Meta;
    serie_0: BotTimeseriesGroupsResponse.Serie0;
}
export declare namespace BotTimeseriesGroupsResponse {
    /**
     * Metadata for the results.
     */
    interface Meta {
        /**
         * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
         * Refer to
         * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
         */
        aggInterval: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'ONE_DAY' | 'ONE_WEEK' | 'ONE_MONTH';
        confidenceInfo: Meta.ConfidenceInfo;
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
    interface Serie0 {
        timestamps: Array<string>;
        [k: string]: Array<string> | Array<string> | undefined;
    }
}
export interface BotListParams {
    /**
     * Filters results by bot category.
     */
    botCategory?: 'SEARCH_ENGINE_CRAWLER' | 'SEARCH_ENGINE_OPTIMIZATION' | 'MONITORING_AND_ANALYTICS' | 'ADVERTISING_AND_MARKETING' | 'SOCIAL_MEDIA_MARKETING' | 'PAGE_PREVIEW' | 'ACADEMIC_RESEARCH' | 'SECURITY' | 'ACCESSIBILITY' | 'WEBHOOKS' | 'FEED_FETCHER' | 'AI_CRAWLER' | 'AGGREGATOR' | 'AI_ASSISTANT' | 'AI_SEARCH' | 'ARCHIVER';
    /**
     * Filters results by bot operator.
     */
    botOperator?: string;
    /**
     * Filters results by bot verification status.
     */
    botVerificationStatus?: 'VERIFIED';
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Skips the specified number of objects before fetching the results.
     */
    offset?: number;
}
export interface BotGetParams {
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export interface BotSummaryParams {
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * Filters results by bot name.
     */
    bot?: Array<string>;
    /**
     * Filters results by bot category.
     */
    botCategory?: Array<'SEARCH_ENGINE_CRAWLER' | 'SEARCH_ENGINE_OPTIMIZATION' | 'MONITORING_AND_ANALYTICS' | 'ADVERTISING_AND_MARKETING' | 'SOCIAL_MEDIA_MARKETING' | 'PAGE_PREVIEW' | 'ACADEMIC_RESEARCH' | 'SECURITY' | 'ACCESSIBILITY' | 'WEBHOOKS' | 'FEED_FETCHER' | 'AI_CRAWLER' | 'AGGREGATOR' | 'AI_ASSISTANT' | 'AI_SEARCH' | 'ARCHIVER'>;
    /**
     * Filters results by bot operator.
     */
    botOperator?: Array<string>;
    /**
     * Filters results by bot verification status (Verified vs. Unverified).
     */
    botVerificationStatus?: Array<'VERIFIED'>;
    /**
     * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
     * excludes results from EU, but includes results from NA.
     */
    continent?: Array<string>;
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
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export interface BotTimeseriesParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * Filters results by bot name.
     */
    bot?: Array<string>;
    /**
     * Filters results by bot category.
     */
    botCategory?: Array<'SEARCH_ENGINE_CRAWLER' | 'SEARCH_ENGINE_OPTIMIZATION' | 'MONITORING_AND_ANALYTICS' | 'ADVERTISING_AND_MARKETING' | 'SOCIAL_MEDIA_MARKETING' | 'PAGE_PREVIEW' | 'ACADEMIC_RESEARCH' | 'SECURITY' | 'ACCESSIBILITY' | 'WEBHOOKS' | 'FEED_FETCHER' | 'AI_CRAWLER' | 'AGGREGATOR' | 'AI_ASSISTANT' | 'AI_SEARCH' | 'ARCHIVER'>;
    /**
     * Filters results by bot operator.
     */
    botOperator?: Array<string>;
    /**
     * Filters results by bot verification status (Verified vs. Unverified).
     */
    botVerificationStatus?: Array<'VERIFIED'>;
    /**
     * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
     * excludes results from EU, but includes results from NA.
     */
    continent?: Array<string>;
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
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export interface BotTimeseriesGroupsParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
    /**
     * Filters results by Autonomous System. Specify one or more Autonomous System
     * Numbers (ASNs) as a comma-separated list. Prefix with `-` to exclude ASNs from
     * results. For example, `-174, 3356` excludes results from AS174, but includes
     * results from AS3356.
     */
    asn?: Array<string>;
    /**
     * Filters results by bot name.
     */
    bot?: Array<string>;
    /**
     * Filters results by bot category.
     */
    botCategory?: Array<'SEARCH_ENGINE_CRAWLER' | 'SEARCH_ENGINE_OPTIMIZATION' | 'MONITORING_AND_ANALYTICS' | 'ADVERTISING_AND_MARKETING' | 'SOCIAL_MEDIA_MARKETING' | 'PAGE_PREVIEW' | 'ACADEMIC_RESEARCH' | 'SECURITY' | 'ACCESSIBILITY' | 'WEBHOOKS' | 'FEED_FETCHER' | 'AI_CRAWLER' | 'AGGREGATOR' | 'AI_ASSISTANT' | 'AI_SEARCH' | 'ARCHIVER'>;
    /**
     * Filters results by bot operator.
     */
    botOperator?: Array<string>;
    /**
     * Filters results by bot verification status (Verified vs. Unverified).
     */
    botVerificationStatus?: Array<'VERIFIED'>;
    /**
     * Filters results by continent. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude continents from results. For example, `-EU,NA`
     * excludes results from EU, but includes results from NA.
     */
    continent?: Array<string>;
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
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects per group to the top items within the specified
     * time range. When item count exceeds the limit, extra items appear grouped under
     * an "other" category.
     */
    limitPerGroup?: number;
    /**
     * Filters results by location. Specify a comma-separated list of alpha-2 codes.
     * Prefix with `-` to exclude locations from results. For example, `-US,PT`
     * excludes results from the US, but includes results from PT.
     */
    location?: Array<string>;
    /**
     * Array of names used to label the series in the response.
     */
    name?: Array<string>;
}
export declare namespace Bots {
    export { type BotListResponse as BotListResponse, type BotGetResponse as BotGetResponse, type BotSummaryResponse as BotSummaryResponse, type BotTimeseriesResponse as BotTimeseriesResponse, type BotTimeseriesGroupsResponse as BotTimeseriesGroupsResponse, type BotListParams as BotListParams, type BotGetParams as BotGetParams, type BotSummaryParams as BotSummaryParams, type BotTimeseriesParams as BotTimeseriesParams, type BotTimeseriesGroupsParams as BotTimeseriesGroupsParams, };
    export { WebCrawlers as WebCrawlers, type WebCrawlerSummaryResponse as WebCrawlerSummaryResponse, type WebCrawlerTimeseriesGroupsResponse as WebCrawlerTimeseriesGroupsResponse, type WebCrawlerSummaryParams as WebCrawlerSummaryParams, type WebCrawlerTimeseriesGroupsParams as WebCrawlerTimeseriesGroupsParams, };
}
//# sourceMappingURL=bots.d.ts.map