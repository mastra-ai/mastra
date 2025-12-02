// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as DNSSECAPI from './dnssec';
import {
  DNSSEC,
  DNSSECDeleteParams,
  DNSSECDeleteResponse,
  DNSSECEditParams,
  DNSSECGetParams,
  DNSSECResource,
} from './dnssec';
import * as RecordsAPI from './records';
import {
  AAAARecord,
  ARecord,
  BatchPatch,
  BatchPut,
  CAARecord,
  CERTRecord,
  CNAMERecord,
  DNSKEYRecord,
  DSRecord,
  HTTPSRecord,
  LOCRecord,
  MXRecord,
  NAPTRRecord,
  NSRecord,
  PTRRecord,
  Record,
  RecordBatchParams,
  RecordBatchResponse,
  RecordCreateParams,
  RecordDeleteParams,
  RecordDeleteResponse,
  RecordEditParams,
  RecordExportParams,
  RecordExportResponse,
  RecordGetParams,
  RecordImportParams,
  RecordImportResponse,
  RecordListParams,
  RecordResponse,
  RecordResponsesV4PagePaginationArray,
  RecordScanParams,
  RecordScanResponse,
  RecordTags,
  RecordUpdateParams,
  Records,
  SMIMEARecord,
  SRVRecord,
  SSHFPRecord,
  SVCBRecord,
  TLSARecord,
  TTL,
  TXTRecord,
  URIRecord,
} from './records';
import * as AnalyticsAPI from './analytics/analytics';
import { Analytics } from './analytics/analytics';
import * as SettingsAPI from './settings/settings';
import { DNSSetting, Settings } from './settings/settings';
import * as ZoneTransfersAPI from './zone-transfers/zone-transfers';
import { ZoneTransfers } from './zone-transfers/zone-transfers';

export class DNS extends APIResource {
  dnssec: DNSSECAPI.DNSSECResource = new DNSSECAPI.DNSSECResource(this._client);
  records: RecordsAPI.Records = new RecordsAPI.Records(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);
  analytics: AnalyticsAPI.Analytics = new AnalyticsAPI.Analytics(this._client);
  zoneTransfers: ZoneTransfersAPI.ZoneTransfers = new ZoneTransfersAPI.ZoneTransfers(this._client);
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
  time_delta:
    | 'all'
    | 'auto'
    | 'year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'
    | 'hour'
    | 'dekaminute'
    | 'minute';

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

DNS.DNSSECResource = DNSSECResource;
DNS.Records = Records;
DNS.RecordResponsesV4PagePaginationArray = RecordResponsesV4PagePaginationArray;
DNS.Settings = Settings;
DNS.Analytics = Analytics;
DNS.ZoneTransfers = ZoneTransfers;

export declare namespace DNS {
  export {
    type DNSAnalyticsNominalMetric as DNSAnalyticsNominalMetric,
    type DNSAnalyticsQuery as DNSAnalyticsQuery,
  };

  export {
    DNSSECResource as DNSSECResource,
    type DNSSEC as DNSSEC,
    type DNSSECDeleteResponse as DNSSECDeleteResponse,
    type DNSSECDeleteParams as DNSSECDeleteParams,
    type DNSSECEditParams as DNSSECEditParams,
    type DNSSECGetParams as DNSSECGetParams,
  };

  export {
    Records as Records,
    type ARecord as ARecord,
    type AAAARecord as AAAARecord,
    type BatchPatch as BatchPatch,
    type BatchPut as BatchPut,
    type CAARecord as CAARecord,
    type CERTRecord as CERTRecord,
    type CNAMERecord as CNAMERecord,
    type DNSKEYRecord as DNSKEYRecord,
    type DSRecord as DSRecord,
    type HTTPSRecord as HTTPSRecord,
    type LOCRecord as LOCRecord,
    type MXRecord as MXRecord,
    type NAPTRRecord as NAPTRRecord,
    type NSRecord as NSRecord,
    type PTRRecord as PTRRecord,
    type Record as Record,
    type RecordResponse as RecordResponse,
    type RecordTags as RecordTags,
    type SMIMEARecord as SMIMEARecord,
    type SRVRecord as SRVRecord,
    type SSHFPRecord as SSHFPRecord,
    type SVCBRecord as SVCBRecord,
    type TLSARecord as TLSARecord,
    type TTL as TTL,
    type TXTRecord as TXTRecord,
    type URIRecord as URIRecord,
    type RecordDeleteResponse as RecordDeleteResponse,
    type RecordBatchResponse as RecordBatchResponse,
    type RecordExportResponse as RecordExportResponse,
    type RecordImportResponse as RecordImportResponse,
    type RecordScanResponse as RecordScanResponse,
    RecordResponsesV4PagePaginationArray as RecordResponsesV4PagePaginationArray,
    type RecordCreateParams as RecordCreateParams,
    type RecordUpdateParams as RecordUpdateParams,
    type RecordListParams as RecordListParams,
    type RecordDeleteParams as RecordDeleteParams,
    type RecordBatchParams as RecordBatchParams,
    type RecordEditParams as RecordEditParams,
    type RecordExportParams as RecordExportParams,
    type RecordGetParams as RecordGetParams,
    type RecordImportParams as RecordImportParams,
    type RecordScanParams as RecordScanParams,
  };

  export { Settings as Settings, type DNSSetting as DNSSetting };

  export { Analytics as Analytics };

  export { ZoneTransfers as ZoneTransfers };
}
