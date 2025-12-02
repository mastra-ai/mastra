import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as DetectionsAPI from "./detections.js";
import { DetectionGetParams, DetectionGetResponse, Detections } from "./detections.js";
import * as MoveAPI from "./move.js";
import { Move, MoveBulkParams, MoveBulkResponse, MoveBulkResponsesSinglePage, MoveCreateParams, MoveCreateResponse, MoveCreateResponsesSinglePage } from "./move.js";
import * as PreviewAPI from "./preview.js";
import { Preview, PreviewCreateParams, PreviewCreateResponse, PreviewGetParams, PreviewGetResponse } from "./preview.js";
import * as RawAPI from "./raw.js";
import { Raw, RawGetParams, RawGetResponse } from "./raw.js";
import * as ReclassifyAPI from "./reclassify.js";
import { Reclassify, ReclassifyCreateParams, ReclassifyCreateResponse } from "./reclassify.js";
import * as ReleaseAPI from "./release.js";
import { Release, ReleaseBulkParams, ReleaseBulkResponse, ReleaseBulkResponsesSinglePage } from "./release.js";
import * as TraceAPI from "./trace.js";
import { Trace, TraceGetParams, TraceGetResponse } from "./trace.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Investigate extends APIResource {
    detections: DetectionsAPI.Detections;
    preview: PreviewAPI.Preview;
    raw: RawAPI.Raw;
    trace: TraceAPI.Trace;
    move: MoveAPI.Move;
    reclassify: ReclassifyAPI.Reclassify;
    release: ReleaseAPI.Release;
    /**
     * Returns information for each email that matches the search parameter(s).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const investigateListResponse of client.emailSecurity.investigate.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: InvestigateListParams, options?: Core.RequestOptions): Core.PagePromise<InvestigateListResponsesV4PagePaginationArray, InvestigateListResponse>;
    /**
     * Get message details
     *
     * @example
     * ```ts
     * const investigate =
     *   await client.emailSecurity.investigate.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId: string, params: InvestigateGetParams, options?: Core.RequestOptions): Core.APIPromise<InvestigateGetResponse>;
}
export declare class InvestigateListResponsesV4PagePaginationArray extends V4PagePaginationArray<InvestigateListResponse> {
}
export interface InvestigateListResponse {
    id: string;
    action_log: unknown;
    client_recipients: Array<string>;
    detection_reasons: Array<string>;
    is_phish_submission: boolean;
    is_quarantined: boolean;
    /**
     * The identifier of the message.
     */
    postfix_id: string;
    properties: InvestigateListResponse.Properties;
    ts: string;
    alert_id?: string | null;
    delivery_mode?: 'DIRECT' | 'BCC' | 'JOURNAL' | 'REVIEW_SUBMISSION' | 'DMARC_UNVERIFIED' | 'DMARC_FAILURE_REPORT' | 'DMARC_AGGREGATE_REPORT' | 'THREAT_INTEL_SUBMISSION' | 'SIMULATION_SUBMISSION' | 'API' | 'RETRO_SCAN' | null;
    edf_hash?: string | null;
    final_disposition?: 'MALICIOUS' | 'MALICIOUS-BEC' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'ENCRYPTED' | 'EXTERNAL' | 'UNKNOWN' | 'NONE' | null;
    from?: string | null;
    from_name?: string | null;
    message_id?: string | null;
    sent_date?: string | null;
    subject?: string | null;
    threat_categories?: Array<string> | null;
    to?: Array<string> | null;
    to_name?: Array<string> | null;
    validation?: InvestigateListResponse.Validation | null;
}
export declare namespace InvestigateListResponse {
    interface Properties {
        allowlisted_pattern_type?: string;
        /**
         * @deprecated
         */
        whitelisted_pattern_type?: string;
    }
    interface Validation {
        comment?: string | null;
        dkim?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
        dmarc?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
        spf?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
    }
}
export interface InvestigateGetResponse {
    id: string;
    action_log: unknown;
    client_recipients: Array<string>;
    detection_reasons: Array<string>;
    is_phish_submission: boolean;
    is_quarantined: boolean;
    /**
     * The identifier of the message.
     */
    postfix_id: string;
    properties: InvestigateGetResponse.Properties;
    ts: string;
    alert_id?: string | null;
    delivery_mode?: 'DIRECT' | 'BCC' | 'JOURNAL' | 'REVIEW_SUBMISSION' | 'DMARC_UNVERIFIED' | 'DMARC_FAILURE_REPORT' | 'DMARC_AGGREGATE_REPORT' | 'THREAT_INTEL_SUBMISSION' | 'SIMULATION_SUBMISSION' | 'API' | 'RETRO_SCAN' | null;
    edf_hash?: string | null;
    final_disposition?: 'MALICIOUS' | 'MALICIOUS-BEC' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'ENCRYPTED' | 'EXTERNAL' | 'UNKNOWN' | 'NONE' | null;
    from?: string | null;
    from_name?: string | null;
    message_id?: string | null;
    sent_date?: string | null;
    subject?: string | null;
    threat_categories?: Array<string> | null;
    to?: Array<string> | null;
    to_name?: Array<string> | null;
    validation?: InvestigateGetResponse.Validation | null;
}
export declare namespace InvestigateGetResponse {
    interface Properties {
        allowlisted_pattern_type?: string;
        /**
         * @deprecated
         */
        whitelisted_pattern_type?: string;
    }
    interface Validation {
        comment?: string | null;
        dkim?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
        dmarc?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
        spf?: 'pass' | 'neutral' | 'fail' | 'error' | 'none' | null;
    }
}
export interface InvestigateListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Query param: Determines if the message action log is included in the response.
     */
    action_log?: boolean;
    /**
     * Query param:
     */
    alert_id?: string;
    /**
     * Query param: Determines if the search results will include detections or not.
     */
    detections_only?: boolean;
    /**
     * Query param: The sender domains the search filters by.
     */
    domain?: string;
    /**
     * Query param: The end of the search date range. Defaults to `now`.
     */
    end?: string;
    /**
     * Query param: The dispositions the search filters by.
     */
    final_disposition?: 'MALICIOUS' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'NONE';
    /**
     * Query param: The message actions the search filters by.
     */
    message_action?: 'PREVIEW' | 'QUARANTINE_RELEASED' | 'MOVED';
    /**
     * Query param:
     */
    message_id?: string;
    /**
     * Query param:
     */
    metric?: string;
    /**
     * Query param: The space-delimited term used in the query. The search is
     * case-insensitive.
     *
     * The content of the following email metadata fields are searched:
     *
     * - alert_id
     * - CC
     * - From (envelope_from)
     * - From Name
     * - final_disposition
     * - md5 hash (of any attachment)
     * - sha1 hash (of any attachment)
     * - sha256 hash (of any attachment)
     * - name (of any attachment)
     * - Reason
     * - Received DateTime (yyyy-mm-ddThh:mm:ss)
     * - Sent DateTime (yyyy-mm-ddThh:mm:ss)
     * - ReplyTo
     * - To (envelope_to)
     * - To Name
     * - Message-ID
     * - smtp_helo_server_ip
     * - smtp_previous_hop_ip
     * - x_originating_ip
     * - Subject
     */
    query?: string;
    /**
     * Query param:
     */
    recipient?: string;
    /**
     * Query param:
     */
    sender?: string;
    /**
     * Query param: The beginning of the search date range. Defaults to
     * `now - 30 days`.
     */
    start?: string;
}
export interface InvestigateGetParams {
    /**
     * Account Identifier
     */
    account_id: string;
}
export declare namespace Investigate {
    export { type InvestigateListResponse as InvestigateListResponse, type InvestigateGetResponse as InvestigateGetResponse, InvestigateListResponsesV4PagePaginationArray as InvestigateListResponsesV4PagePaginationArray, type InvestigateListParams as InvestigateListParams, type InvestigateGetParams as InvestigateGetParams, };
    export { Detections as Detections, type DetectionGetResponse as DetectionGetResponse, type DetectionGetParams as DetectionGetParams, };
    export { Preview as Preview, type PreviewCreateResponse as PreviewCreateResponse, type PreviewGetResponse as PreviewGetResponse, type PreviewCreateParams as PreviewCreateParams, type PreviewGetParams as PreviewGetParams, };
    export { Raw as Raw, type RawGetResponse as RawGetResponse, type RawGetParams as RawGetParams };
    export { Trace as Trace, type TraceGetResponse as TraceGetResponse, type TraceGetParams as TraceGetParams };
    export { Move as Move, type MoveCreateResponse as MoveCreateResponse, type MoveBulkResponse as MoveBulkResponse, MoveCreateResponsesSinglePage as MoveCreateResponsesSinglePage, MoveBulkResponsesSinglePage as MoveBulkResponsesSinglePage, type MoveCreateParams as MoveCreateParams, type MoveBulkParams as MoveBulkParams, };
    export { Reclassify as Reclassify, type ReclassifyCreateResponse as ReclassifyCreateResponse, type ReclassifyCreateParams as ReclassifyCreateParams, };
    export { Release as Release, type ReleaseBulkResponse as ReleaseBulkResponse, ReleaseBulkResponsesSinglePage as ReleaseBulkResponsesSinglePage, type ReleaseBulkParams as ReleaseBulkParams, };
}
//# sourceMappingURL=investigate.d.ts.map