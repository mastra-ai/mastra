import { APIResource } from "../../resource.js";
import * as DNSSECAPI from "./dnssec.js";
import { DNSSEC, DNSSECDeleteParams, DNSSECDeleteResponse, DNSSECEditParams, DNSSECGetParams, DNSSECResource } from "./dnssec.js";
import * as RecordsAPI from "./records.js";
import { AAAARecord, ARecord, BatchPatch, BatchPut, CAARecord, CERTRecord, CNAMERecord, DNSKEYRecord, DSRecord, HTTPSRecord, LOCRecord, MXRecord, NAPTRRecord, NSRecord, PTRRecord, Record, RecordBatchParams, RecordBatchResponse, RecordCreateParams, RecordDeleteParams, RecordDeleteResponse, RecordEditParams, RecordExportParams, RecordExportResponse, RecordGetParams, RecordImportParams, RecordImportResponse, RecordListParams, RecordResponse, RecordResponsesV4PagePaginationArray, RecordScanParams, RecordScanResponse, RecordTags, RecordUpdateParams, Records, SMIMEARecord, SRVRecord, SSHFPRecord, SVCBRecord, TLSARecord, TTL, TXTRecord, URIRecord } from "./records.js";
import * as AnalyticsAPI from "./analytics/analytics.js";
import { Analytics } from "./analytics/analytics.js";
import * as SettingsAPI from "./settings/settings.js";
import { DNSSetting, Settings } from "./settings/settings.js";
import * as ZoneTransfersAPI from "./zone-transfers/zone-transfers.js";
import { ZoneTransfers } from "./zone-transfers/zone-transfers.js";
export declare class DNS extends APIResource {
    dnssec: DNSSECAPI.DNSSECResource;
    records: RecordsAPI.Records;
    settings: SettingsAPI.Settings;
    analytics: AnalyticsAPI.Analytics;
    zoneTransfers: ZoneTransfersAPI.ZoneTransfers;
}
/**
 * Nominal metric values, broken down by time interval.
 */
export type DNSAnalyticsNominalMetric = Array<unknown>;
export interface DNSAnalyticsQuery {
    /**
     * Array of dimension names.
     */
    dimensions: Array<string>;
    /**
     * Limit number of returned metrics.
     */
    limit: number;
    /**
     * Array of metric names.
     */
    metrics: Array<string>;
    /**
     * Start date and time of requesting data period in ISO 8601 format.
     */
    since: string;
    /**
     * Unit of time to group data by.
     */
    time_delta: 'all' | 'auto' | 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'dekaminute' | 'minute';
    /**
     * End date and time of requesting data period in ISO 8601 format.
     */
    until: string;
    /**
     * Segmentation filter in 'attribute operator value' format.
     */
    filters?: string;
    /**
     * Array of dimensions to sort by, where each dimension may be prefixed by -
     * (descending) or + (ascending).
     */
    sort?: Array<string>;
}
export declare namespace DNS {
    export { type DNSAnalyticsNominalMetric as DNSAnalyticsNominalMetric, type DNSAnalyticsQuery as DNSAnalyticsQuery, };
    export { DNSSECResource as DNSSECResource, type DNSSEC as DNSSEC, type DNSSECDeleteResponse as DNSSECDeleteResponse, type DNSSECDeleteParams as DNSSECDeleteParams, type DNSSECEditParams as DNSSECEditParams, type DNSSECGetParams as DNSSECGetParams, };
    export { Records as Records, type ARecord as ARecord, type AAAARecord as AAAARecord, type BatchPatch as BatchPatch, type BatchPut as BatchPut, type CAARecord as CAARecord, type CERTRecord as CERTRecord, type CNAMERecord as CNAMERecord, type DNSKEYRecord as DNSKEYRecord, type DSRecord as DSRecord, type HTTPSRecord as HTTPSRecord, type LOCRecord as LOCRecord, type MXRecord as MXRecord, type NAPTRRecord as NAPTRRecord, type NSRecord as NSRecord, type PTRRecord as PTRRecord, type Record as Record, type RecordResponse as RecordResponse, type RecordTags as RecordTags, type SMIMEARecord as SMIMEARecord, type SRVRecord as SRVRecord, type SSHFPRecord as SSHFPRecord, type SVCBRecord as SVCBRecord, type TLSARecord as TLSARecord, type TTL as TTL, type TXTRecord as TXTRecord, type URIRecord as URIRecord, type RecordDeleteResponse as RecordDeleteResponse, type RecordBatchResponse as RecordBatchResponse, type RecordExportResponse as RecordExportResponse, type RecordImportResponse as RecordImportResponse, type RecordScanResponse as RecordScanResponse, RecordResponsesV4PagePaginationArray as RecordResponsesV4PagePaginationArray, type RecordCreateParams as RecordCreateParams, type RecordUpdateParams as RecordUpdateParams, type RecordListParams as RecordListParams, type RecordDeleteParams as RecordDeleteParams, type RecordBatchParams as RecordBatchParams, type RecordEditParams as RecordEditParams, type RecordExportParams as RecordExportParams, type RecordGetParams as RecordGetParams, type RecordImportParams as RecordImportParams, type RecordScanParams as RecordScanParams, };
    export { Settings as Settings, type DNSSetting as DNSSetting };
    export { Analytics as Analytics };
    export { ZoneTransfers as ZoneTransfers };
}
//# sourceMappingURL=dns.d.ts.map