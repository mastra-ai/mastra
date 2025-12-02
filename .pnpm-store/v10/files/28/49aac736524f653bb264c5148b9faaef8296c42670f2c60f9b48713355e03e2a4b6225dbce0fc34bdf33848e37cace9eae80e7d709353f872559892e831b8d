import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Jobs extends APIResource {
    /**
     * Creates a new Logpush job for an account or zone.
     *
     * @example
     * ```ts
     * const logpushJob = await client.logpush.jobs.create({
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   account_id: 'account_id',
     *   dataset: 'gateway_dns',
     *   filter:
     *     '{"where":{"and":[{"key":"ClientRequestPath","operator":"contains","value":"/static"},{"key":"ClientRequestHost","operator":"eq","value":"example.com"}]}}',
     *   max_upload_bytes: 5000000,
     *   max_upload_interval_seconds: 30,
     *   max_upload_records: 1000,
     *   name: 'example.com',
     *   output_options: {
     *     'CVE-2021-44228': false,
     *     batch_prefix: '',
     *     batch_suffix: '',
     *     field_delimiter: ',',
     *     field_names: ['Datetime', 'DstIP', 'SrcIP'],
     *     output_type: 'ndjson',
     *     record_delimiter: '',
     *     record_prefix: '{',
     *     record_suffix: '}\n',
     *     sample_rate: 1,
     *     timestamp_format: 'unixnano',
     *   },
     * });
     * ```
     */
    create(params: JobCreateParams, options?: Core.RequestOptions): Core.APIPromise<LogpushJob | null>;
    /**
     * Updates a Logpush job.
     *
     * @example
     * ```ts
     * const logpushJob = await client.logpush.jobs.update(1, {
     *   account_id: 'account_id',
     *   destination_conf: 's3://mybucket/logs?region=us-west-2',
     *   filter:
     *     '{"where":{"and":[{"key":"ClientRequestPath","operator":"contains","value":"/static"},{"key":"ClientRequestHost","operator":"eq","value":"example.com"}]}}',
     *   max_upload_bytes: 5000000,
     *   max_upload_interval_seconds: 30,
     *   max_upload_records: 1000,
     *   output_options: {
     *     'CVE-2021-44228': false,
     *     batch_prefix: '',
     *     batch_suffix: '',
     *     field_delimiter: ',',
     *     field_names: ['Datetime', 'DstIP', 'SrcIP'],
     *     output_type: 'ndjson',
     *     record_delimiter: '',
     *     record_prefix: '{',
     *     record_suffix: '}\n',
     *     sample_rate: 1,
     *     timestamp_format: 'unixnano',
     *   },
     * });
     * ```
     */
    update(jobId: number, params: JobUpdateParams, options?: Core.RequestOptions): Core.APIPromise<LogpushJob | null>;
    /**
     * Lists Logpush jobs for an account or zone.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logpushJob of client.logpush.jobs.list({
     *   account_id: 'account_id',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params?: JobListParams, options?: Core.RequestOptions): Core.PagePromise<LogpushJobsSinglePage, LogpushJob | null>;
    list(options?: Core.RequestOptions): Core.PagePromise<LogpushJobsSinglePage, LogpushJob | null>;
    /**
     * Deletes a Logpush job.
     *
     * @example
     * ```ts
     * const job = await client.logpush.jobs.delete(1, {
     *   account_id: 'account_id',
     * });
     * ```
     */
    delete(jobId: number, params?: JobDeleteParams, options?: Core.RequestOptions): Core.APIPromise<JobDeleteResponse>;
    delete(jobId: number, options?: Core.RequestOptions): Core.APIPromise<JobDeleteResponse>;
    /**
     * Gets the details of a Logpush job.
     *
     * @example
     * ```ts
     * const logpushJob = await client.logpush.jobs.get(1, {
     *   account_id: 'account_id',
     * });
     * ```
     */
    get(jobId: number, params?: JobGetParams, options?: Core.RequestOptions): Core.APIPromise<LogpushJob | null>;
    get(jobId: number, options?: Core.RequestOptions): Core.APIPromise<LogpushJob | null>;
}
export declare class LogpushJobsSinglePage extends SinglePage<LogpushJob | null> {
}
export interface LogpushJob {
    /**
     * Unique id of the job.
     */
    id?: number;
    /**
     * Name of the dataset. A list of supported datasets can be found on the
     * [Developer Docs](https://developers.cloudflare.com/logs/reference/log-fields/).
     */
    dataset?: 'access_requests' | 'audit_logs' | 'biso_user_actions' | 'casb_findings' | 'device_posture_results' | 'dlp_forensic_copies' | 'dns_firewall_logs' | 'dns_logs' | 'email_security_alerts' | 'firewall_events' | 'gateway_dns' | 'gateway_http' | 'gateway_network' | 'http_requests' | 'magic_ids_detections' | 'nel_reports' | 'network_analytics_logs' | 'page_shield_events' | 'sinkhole_http_logs' | 'spectrum_events' | 'ssh_logs' | 'workers_trace_events' | 'zaraz_events' | 'zero_trust_network_sessions' | null;
    /**
     * Uniquely identifies a resource (such as an s3 bucket) where data will be pushed.
     * Additional configuration parameters supported by the destination may be
     * included.
     */
    destination_conf?: string;
    /**
     * Flag that indicates if the job is enabled.
     */
    enabled?: boolean;
    /**
     * If not null, the job is currently failing. Failures are usually repetitive
     * (example: no permissions to write to destination bucket). Only the last failure
     * is recorded. On successful execution of a job the error_message and last_error
     * are set to null.
     */
    error_message?: string | null;
    /**
     * @deprecated This field is deprecated. Please use `max_upload_*` parameters
     * instead. The frequency at which Cloudflare sends batches of logs to your
     * destination. Setting frequency to high sends your logs in larger quantities of
     * smaller files. Setting frequency to low sends logs in smaller quantities of
     * larger files.
     */
    frequency?: 'high' | 'low' | null;
    /**
     * The kind parameter (optional) is used to differentiate between Logpush and Edge
     * Log Delivery jobs (when supported by the dataset).
     */
    kind?: '' | 'edge';
    /**
     * Records the last time for which logs have been successfully pushed. If the last
     * successful push was for logs range 2018-07-23T10:00:00Z to 2018-07-23T10:01:00Z
     * then the value of this field will be 2018-07-23T10:01:00Z. If the job has never
     * run or has just been enabled and hasn't run yet then the field will be empty.
     */
    last_complete?: string | null;
    /**
     * Records the last time the job failed. If not null, the job is currently failing.
     * If null, the job has either never failed or has run successfully at least once
     * since last failure. See also the error_message field.
     */
    last_error?: string | null;
    /**
     * @deprecated This field is deprecated. Use `output_options` instead.
     * Configuration string. It specifies things like requested fields and timestamp
     * formats. If migrating from the logpull api, copy the url (full url or just the
     * query string) of your call here, and logpush will keep on making this call for
     * you, setting start and end times appropriately.
     */
    logpull_options?: string | null;
    /**
     * The maximum uncompressed file size of a batch of logs. This setting value must
     * be between `5 MB` and `1 GB`, or `0` to disable it. Note that you cannot set a
     * minimum file size; this means that log files may be much smaller than this batch
     * size.
     */
    max_upload_bytes?: 0 | unknown | null;
    /**
     * The maximum interval in seconds for log batches. This setting must be between 30
     * and 300 seconds (5 minutes), or `0` to disable it. Note that you cannot specify
     * a minimum interval for log batches; this means that log files may be sent in
     * shorter intervals than this.
     */
    max_upload_interval_seconds?: 0 | unknown | null;
    /**
     * The maximum number of log lines per batch. This setting must be between 1000 and
     * 1,000,000 lines, or `0` to disable it. Note that you cannot specify a minimum
     * number of log lines per batch; this means that log files may contain many fewer
     * lines than this.
     */
    max_upload_records?: 0 | unknown | null;
    /**
     * Optional human readable job name. Not unique. Cloudflare suggests that you set
     * this to a meaningful string, like the domain name, to make it easier to identify
     * your job.
     */
    name?: string | null;
    /**
     * The structured replacement for `logpull_options`. When including this field, the
     * `logpull_option` field will be ignored.
     */
    output_options?: OutputOptions | null;
}
/**
 * The structured replacement for `logpull_options`. When including this field, the
 * `logpull_option` field will be ignored.
 */
export interface OutputOptions {
    /**
     * String to be prepended before each batch.
     */
    batch_prefix?: string | null;
    /**
     * String to be appended after each batch.
     */
    batch_suffix?: string | null;
    /**
     * If set to true, will cause all occurrences of `${` in the generated files to be
     * replaced with `x{`.
     */
    'CVE-2021-44228'?: boolean | null;
    /**
     * String to join fields. This field be ignored when `record_template` is set.
     */
    field_delimiter?: string | null;
    /**
     * List of field names to be included in the Logpush output. For the moment, there
     * is no option to add all fields at once, so you must specify all the fields names
     * you are interested in.
     */
    field_names?: Array<string>;
    /**
     * Specifies the output type, such as `ndjson` or `csv`. This sets default values
     * for the rest of the settings, depending on the chosen output type. Some
     * formatting rules, like string quoting, are different between output types.
     */
    output_type?: 'ndjson' | 'csv';
    /**
     * String to be inserted in-between the records as separator.
     */
    record_delimiter?: string | null;
    /**
     * String to be prepended before each record.
     */
    record_prefix?: string | null;
    /**
     * String to be appended after each record.
     */
    record_suffix?: string | null;
    /**
     * String to use as template for each record instead of the default json key value
     * mapping. All fields used in the template must be present in `field_names` as
     * well, otherwise they will end up as null. Format as a Go `text/template` without
     * any standard functions, like conditionals, loops, sub-templates, etc.
     */
    record_template?: string | null;
    /**
     * Floating number to specify sampling rate. Sampling is applied on top of
     * filtering, and regardless of the current `sample_interval` of the data.
     */
    sample_rate?: number | null;
    /**
     * String to specify the format for timestamps, such as `unixnano`, `unix`, or
     * `rfc3339`.
     */
    timestamp_format?: 'unixnano' | 'unix' | 'rfc3339';
}
/**
 * The structured replacement for `logpull_options`. When including this field, the
 * `logpull_option` field will be ignored.
 */
export interface OutputOptionsParam {
    /**
     * String to be prepended before each batch.
     */
    batch_prefix?: string | null;
    /**
     * String to be appended after each batch.
     */
    batch_suffix?: string | null;
    /**
     * If set to true, will cause all occurrences of `${` in the generated files to be
     * replaced with `x{`.
     */
    'CVE-2021-44228'?: boolean | null;
    /**
     * String to join fields. This field be ignored when `record_template` is set.
     */
    field_delimiter?: string | null;
    /**
     * List of field names to be included in the Logpush output. For the moment, there
     * is no option to add all fields at once, so you must specify all the fields names
     * you are interested in.
     */
    field_names?: Array<string>;
    /**
     * Specifies the output type, such as `ndjson` or `csv`. This sets default values
     * for the rest of the settings, depending on the chosen output type. Some
     * formatting rules, like string quoting, are different between output types.
     */
    output_type?: 'ndjson' | 'csv';
    /**
     * String to be inserted in-between the records as separator.
     */
    record_delimiter?: string | null;
    /**
     * String to be prepended before each record.
     */
    record_prefix?: string | null;
    /**
     * String to be appended after each record.
     */
    record_suffix?: string | null;
    /**
     * String to use as template for each record instead of the default json key value
     * mapping. All fields used in the template must be present in `field_names` as
     * well, otherwise they will end up as null. Format as a Go `text/template` without
     * any standard functions, like conditionals, loops, sub-templates, etc.
     */
    record_template?: string | null;
    /**
     * Floating number to specify sampling rate. Sampling is applied on top of
     * filtering, and regardless of the current `sample_interval` of the data.
     */
    sample_rate?: number | null;
    /**
     * String to specify the format for timestamps, such as `unixnano`, `unix`, or
     * `rfc3339`.
     */
    timestamp_format?: 'unixnano' | 'unix' | 'rfc3339';
}
export interface JobDeleteResponse {
    /**
     * Unique id of the job.
     */
    id?: number;
}
export interface JobCreateParams {
    /**
     * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
     * will be pushed. Additional configuration parameters supported by the destination
     * may be included.
     */
    destination_conf: string;
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Name of the dataset. A list of supported datasets can be found on
     * the
     * [Developer Docs](https://developers.cloudflare.com/logs/reference/log-fields/).
     */
    dataset?: 'access_requests' | 'audit_logs' | 'biso_user_actions' | 'casb_findings' | 'device_posture_results' | 'dlp_forensic_copies' | 'dns_firewall_logs' | 'dns_logs' | 'email_security_alerts' | 'firewall_events' | 'gateway_dns' | 'gateway_http' | 'gateway_network' | 'http_requests' | 'magic_ids_detections' | 'nel_reports' | 'network_analytics_logs' | 'page_shield_events' | 'sinkhole_http_logs' | 'spectrum_events' | 'ssh_logs' | 'workers_trace_events' | 'zaraz_events' | 'zero_trust_network_sessions' | null;
    /**
     * Body param: Flag that indicates if the job is enabled.
     */
    enabled?: boolean;
    /**
     * Body param: The filters to select the events to include and/or remove from your
     * logs. For more information, refer to
     * [Filters](https://developers.cloudflare.com/logs/reference/filters/).
     */
    filter?: string | null;
    /**
     * @deprecated Body param: This field is deprecated. Please use `max_upload_*`
     * parameters instead. The frequency at which Cloudflare sends batches of logs to
     * your destination. Setting frequency to high sends your logs in larger quantities
     * of smaller files. Setting frequency to low sends logs in smaller quantities of
     * larger files.
     */
    frequency?: 'high' | 'low' | null;
    /**
     * Body param: The kind parameter (optional) is used to differentiate between
     * Logpush and Edge Log Delivery jobs (when supported by the dataset).
     */
    kind?: '' | 'edge';
    /**
     * @deprecated Body param: This field is deprecated. Use `output_options` instead.
     * Configuration string. It specifies things like requested fields and timestamp
     * formats. If migrating from the logpull api, copy the url (full url or just the
     * query string) of your call here, and logpush will keep on making this call for
     * you, setting start and end times appropriately.
     */
    logpull_options?: string | null;
    /**
     * Body param: The maximum uncompressed file size of a batch of logs. This setting
     * value must be between `5 MB` and `1 GB`, or `0` to disable it. Note that you
     * cannot set a minimum file size; this means that log files may be much smaller
     * than this batch size.
     */
    max_upload_bytes?: 0 | unknown | null;
    /**
     * Body param: The maximum interval in seconds for log batches. This setting must
     * be between 30 and 300 seconds (5 minutes), or `0` to disable it. Note that you
     * cannot specify a minimum interval for log batches; this means that log files may
     * be sent in shorter intervals than this.
     */
    max_upload_interval_seconds?: 0 | unknown | null;
    /**
     * Body param: The maximum number of log lines per batch. This setting must be
     * between 1000 and 1,000,000 lines, or `0` to disable it. Note that you cannot
     * specify a minimum number of log lines per batch; this means that log files may
     * contain many fewer lines than this.
     */
    max_upload_records?: 0 | unknown | null;
    /**
     * Body param: Optional human readable job name. Not unique. Cloudflare suggests
     * that you set this to a meaningful string, like the domain name, to make it
     * easier to identify your job.
     */
    name?: string | null;
    /**
     * Body param: The structured replacement for `logpull_options`. When including
     * this field, the `logpull_option` field will be ignored.
     */
    output_options?: OutputOptionsParam | null;
    /**
     * Body param: Ownership challenge token to prove destination ownership.
     */
    ownership_challenge?: string;
}
export interface JobUpdateParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Uniquely identifies a resource (such as an s3 bucket) where data
     * will be pushed. Additional configuration parameters supported by the destination
     * may be included.
     */
    destination_conf?: string;
    /**
     * Body param: Flag that indicates if the job is enabled.
     */
    enabled?: boolean;
    /**
     * Body param: The filters to select the events to include and/or remove from your
     * logs. For more information, refer to
     * [Filters](https://developers.cloudflare.com/logs/reference/filters/).
     */
    filter?: string | null;
    /**
     * @deprecated Body param: This field is deprecated. Please use `max_upload_*`
     * parameters instead. The frequency at which Cloudflare sends batches of logs to
     * your destination. Setting frequency to high sends your logs in larger quantities
     * of smaller files. Setting frequency to low sends logs in smaller quantities of
     * larger files.
     */
    frequency?: 'high' | 'low' | null;
    /**
     * Body param: The kind parameter (optional) is used to differentiate between
     * Logpush and Edge Log Delivery jobs (when supported by the dataset).
     */
    kind?: '' | 'edge';
    /**
     * @deprecated Body param: This field is deprecated. Use `output_options` instead.
     * Configuration string. It specifies things like requested fields and timestamp
     * formats. If migrating from the logpull api, copy the url (full url or just the
     * query string) of your call here, and logpush will keep on making this call for
     * you, setting start and end times appropriately.
     */
    logpull_options?: string | null;
    /**
     * Body param: The maximum uncompressed file size of a batch of logs. This setting
     * value must be between `5 MB` and `1 GB`, or `0` to disable it. Note that you
     * cannot set a minimum file size; this means that log files may be much smaller
     * than this batch size.
     */
    max_upload_bytes?: 0 | unknown | null;
    /**
     * Body param: The maximum interval in seconds for log batches. This setting must
     * be between 30 and 300 seconds (5 minutes), or `0` to disable it. Note that you
     * cannot specify a minimum interval for log batches; this means that log files may
     * be sent in shorter intervals than this.
     */
    max_upload_interval_seconds?: 0 | unknown | null;
    /**
     * Body param: The maximum number of log lines per batch. This setting must be
     * between 1000 and 1,000,000 lines, or `0` to disable it. Note that you cannot
     * specify a minimum number of log lines per batch; this means that log files may
     * contain many fewer lines than this.
     */
    max_upload_records?: 0 | unknown | null;
    /**
     * Body param: Optional human readable job name. Not unique. Cloudflare suggests
     * that you set this to a meaningful string, like the domain name, to make it
     * easier to identify your job.
     */
    name?: string | null;
    /**
     * Body param: The structured replacement for `logpull_options`. When including
     * this field, the `logpull_option` field will be ignored.
     */
    output_options?: OutputOptionsParam | null;
    /**
     * Body param: Ownership challenge token to prove destination ownership.
     */
    ownership_challenge?: string;
}
export interface JobListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface JobDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
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
    export { type LogpushJob as LogpushJob, type OutputOptions as OutputOptions, type JobDeleteResponse as JobDeleteResponse, LogpushJobsSinglePage as LogpushJobsSinglePage, type JobCreateParams as JobCreateParams, type JobUpdateParams as JobUpdateParams, type JobListParams as JobListParams, type JobDeleteParams as JobDeleteParams, type JobGetParams as JobGetParams, };
}
//# sourceMappingURL=jobs.d.ts.map