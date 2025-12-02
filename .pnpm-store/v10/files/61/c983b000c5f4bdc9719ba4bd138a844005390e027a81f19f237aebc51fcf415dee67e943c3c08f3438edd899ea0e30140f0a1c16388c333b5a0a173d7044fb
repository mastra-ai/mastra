import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SummaryAPI from "./summary.js";
import { Summary, SummaryDNSSECParams, SummaryDNSSECResponse, SummaryEdnsParams, SummaryEdnsResponse, SummaryIPVersionParams, SummaryIPVersionResponse, SummaryProtocolParams, SummaryProtocolResponse, SummaryQueryTypeParams, SummaryQueryTypeResponse, SummaryResponseCodesParams, SummaryResponseCodesResponse } from "./summary.js";
import * as TimeseriesGroupsAPI from "./timeseries-groups.js";
import { TimeseriesGroupDNSSECParams, TimeseriesGroupDNSSECResponse, TimeseriesGroupEdnsParams, TimeseriesGroupEdnsResponse, TimeseriesGroupIPVersionParams, TimeseriesGroupIPVersionResponse, TimeseriesGroupProtocolParams, TimeseriesGroupProtocolResponse, TimeseriesGroupQueryTypeParams, TimeseriesGroupQueryTypeResponse, TimeseriesGroupResponseCodesParams, TimeseriesGroupResponseCodesResponse, TimeseriesGroups } from "./timeseries-groups.js";
import * as TopAPI from "./top.js";
import { Top, TopDNSSECParams, TopDNSSECResponse, TopEdnsParams, TopEdnsResponse, TopIPVersionParams, TopIPVersionResponse, TopLocationsParams, TopLocationsResponse } from "./top.js";
export declare class AS112 extends APIResource {
    summary: SummaryAPI.Summary;
    timeseriesGroups: TimeseriesGroupsAPI.TimeseriesGroups;
    top: TopAPI.Top;
    /**
     * Retrieves the AS112 DNS queries over time.
     *
     * @example
     * ```ts
     * const response = await client.radar.as112.timeseries();
     * ```
     */
    timeseries(query?: AS112TimeseriesParams, options?: Core.RequestOptions): Core.APIPromise<AS112TimeseriesResponse>;
    timeseries(options?: Core.RequestOptions): Core.APIPromise<AS112TimeseriesResponse>;
}
export interface AS112TimeseriesResponse {
    /**
     * Metadata for the results.
     */
    meta: AS112TimeseriesResponse.Meta;
    [k: string]: AS112TimeseriesResponse.unnamed_schema_ref_75bae70cf28e6bcef364b9840db3bdeb | AS112TimeseriesResponse.Meta | undefined;
}
export declare namespace AS112TimeseriesResponse {
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
export interface AS112TimeseriesParams {
    /**
     * Aggregation interval of the results (e.g., in 15 minutes or 1 hour intervals).
     * Refer to
     * [Aggregation intervals](https://developers.cloudflare.com/radar/concepts/aggregation-intervals/).
     */
    aggInterval?: '15m' | '1h' | '1d' | '1w';
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
    /**
     * Filters results by DNS transport protocol.
     */
    protocol?: 'UDP' | 'TCP' | 'HTTPS' | 'TLS';
    /**
     * Filters results by DNS query type.
     */
    queryType?: 'A' | 'AAAA' | 'A6' | 'AFSDB' | 'ANY' | 'APL' | 'ATMA' | 'AXFR' | 'CAA' | 'CDNSKEY' | 'CDS' | 'CERT' | 'CNAME' | 'CSYNC' | 'DHCID' | 'DLV' | 'DNAME' | 'DNSKEY' | 'DOA' | 'DS' | 'EID' | 'EUI48' | 'EUI64' | 'GPOS' | 'GID' | 'HINFO' | 'HIP' | 'HTTPS' | 'IPSECKEY' | 'ISDN' | 'IXFR' | 'KEY' | 'KX' | 'L32' | 'L64' | 'LOC' | 'LP' | 'MAILA' | 'MAILB' | 'MB' | 'MD' | 'MF' | 'MG' | 'MINFO' | 'MR' | 'MX' | 'NAPTR' | 'NB' | 'NBSTAT' | 'NID' | 'NIMLOC' | 'NINFO' | 'NS' | 'NSAP' | 'NSEC' | 'NSEC3' | 'NSEC3PARAM' | 'NULL' | 'NXT' | 'OPENPGPKEY' | 'OPT' | 'PTR' | 'PX' | 'RKEY' | 'RP' | 'RRSIG' | 'RT' | 'SIG' | 'SINK' | 'SMIMEA' | 'SOA' | 'SPF' | 'SRV' | 'SSHFP' | 'SVCB' | 'TA' | 'TALINK' | 'TKEY' | 'TLSA' | 'TSIG' | 'TXT' | 'UINFO' | 'UID' | 'UNSPEC' | 'URI' | 'WKS' | 'X25' | 'ZONEMD' | null;
    /**
     * Filters results by DNS response code.
     */
    responseCode?: 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET' | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE' | 'BADSIG' | 'BADKEY' | 'BADTIME' | 'BADMODE' | 'BADNAME' | 'BADALG' | 'BADTRUNC' | 'BADCOOKIE';
}
export declare namespace AS112 {
    export { type AS112TimeseriesResponse as AS112TimeseriesResponse, type AS112TimeseriesParams as AS112TimeseriesParams, };
    export { Summary as Summary, type SummaryDNSSECResponse as SummaryDNSSECResponse, type SummaryEdnsResponse as SummaryEdnsResponse, type SummaryIPVersionResponse as SummaryIPVersionResponse, type SummaryProtocolResponse as SummaryProtocolResponse, type SummaryQueryTypeResponse as SummaryQueryTypeResponse, type SummaryResponseCodesResponse as SummaryResponseCodesResponse, type SummaryDNSSECParams as SummaryDNSSECParams, type SummaryEdnsParams as SummaryEdnsParams, type SummaryIPVersionParams as SummaryIPVersionParams, type SummaryProtocolParams as SummaryProtocolParams, type SummaryQueryTypeParams as SummaryQueryTypeParams, type SummaryResponseCodesParams as SummaryResponseCodesParams, };
    export { TimeseriesGroups as TimeseriesGroups, type TimeseriesGroupDNSSECResponse as TimeseriesGroupDNSSECResponse, type TimeseriesGroupEdnsResponse as TimeseriesGroupEdnsResponse, type TimeseriesGroupIPVersionResponse as TimeseriesGroupIPVersionResponse, type TimeseriesGroupProtocolResponse as TimeseriesGroupProtocolResponse, type TimeseriesGroupQueryTypeResponse as TimeseriesGroupQueryTypeResponse, type TimeseriesGroupResponseCodesResponse as TimeseriesGroupResponseCodesResponse, type TimeseriesGroupDNSSECParams as TimeseriesGroupDNSSECParams, type TimeseriesGroupEdnsParams as TimeseriesGroupEdnsParams, type TimeseriesGroupIPVersionParams as TimeseriesGroupIPVersionParams, type TimeseriesGroupProtocolParams as TimeseriesGroupProtocolParams, type TimeseriesGroupQueryTypeParams as TimeseriesGroupQueryTypeParams, type TimeseriesGroupResponseCodesParams as TimeseriesGroupResponseCodesParams, };
    export { Top as Top, type TopDNSSECResponse as TopDNSSECResponse, type TopEdnsResponse as TopEdnsResponse, type TopIPVersionResponse as TopIPVersionResponse, type TopLocationsResponse as TopLocationsResponse, type TopDNSSECParams as TopDNSSECParams, type TopEdnsParams as TopEdnsParams, type TopIPVersionParams as TopIPVersionParams, type TopLocationsParams as TopLocationsParams, };
}
//# sourceMappingURL=as112.d.ts.map