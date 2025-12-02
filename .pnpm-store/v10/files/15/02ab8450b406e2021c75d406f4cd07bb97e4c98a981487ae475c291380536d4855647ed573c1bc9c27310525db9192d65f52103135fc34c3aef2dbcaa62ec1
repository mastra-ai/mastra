import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as JobsAPI from "../jobs.js";
import { LogpushJobsSinglePage } from "../jobs.js";
export declare class Jobs extends APIResource {
    /**
     * Lists Logpush jobs for an account or zone for a dataset.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logpushJob of client.logpush.datasets.jobs.get(
     *   'gateway_dns',
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(datasetId: 'access_requests' | 'audit_logs' | 'biso_user_actions' | 'casb_findings' | 'device_posture_results' | 'dlp_forensic_copies' | 'dns_firewall_logs' | 'dns_logs' | 'email_security_alerts' | 'firewall_events' | 'gateway_dns' | 'gateway_http' | 'gateway_network' | 'http_requests' | 'magic_ids_detections' | 'nel_reports' | 'network_analytics_logs' | 'page_shield_events' | 'sinkhole_http_logs' | 'spectrum_events' | 'ssh_logs' | 'workers_trace_events' | 'zaraz_events' | 'zero_trust_network_sessions' | null, params?: JobGetParams, options?: Core.RequestOptions): Core.PagePromise<LogpushJobsSinglePage, JobsAPI.LogpushJob | null>;
    get(datasetId: 'access_requests' | 'audit_logs' | 'biso_user_actions' | 'casb_findings' | 'device_posture_results' | 'dlp_forensic_copies' | 'dns_firewall_logs' | 'dns_logs' | 'email_security_alerts' | 'firewall_events' | 'gateway_dns' | 'gateway_http' | 'gateway_network' | 'http_requests' | 'magic_ids_detections' | 'nel_reports' | 'network_analytics_logs' | 'page_shield_events' | 'sinkhole_http_logs' | 'spectrum_events' | 'ssh_logs' | 'workers_trace_events' | 'zaraz_events' | 'zero_trust_network_sessions' | null, options?: Core.RequestOptions): Core.PagePromise<LogpushJobsSinglePage, JobsAPI.LogpushJob | null>;
}
export interface JobGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace Jobs {
    export { type JobGetParams as JobGetParams };
}
export { LogpushJobsSinglePage };
//# sourceMappingURL=jobs.d.ts.map