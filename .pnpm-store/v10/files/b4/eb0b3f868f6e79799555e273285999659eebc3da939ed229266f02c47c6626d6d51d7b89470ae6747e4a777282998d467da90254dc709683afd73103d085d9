// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as Shared from '../shared';
import { SinglePage } from '../../pagination';

export class Policies extends APIResource {
  /**
   * Creates a new Notification policy.
   *
   * @example
   * ```ts
   * const policy = await client.alerting.policies.create({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   alert_type: 'universal_ssl_event_type',
   *   enabled: true,
   *   mechanisms: {},
   *   name: 'SSL Notification Event Policy',
   * });
   * ```
   */
  create(params: PolicyCreateParams, options?: Core.RequestOptions): Core.APIPromise<PolicyCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/alerting/v3/policies`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PolicyCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Notification policy.
   *
   * @example
   * ```ts
   * const policy = await client.alerting.policies.update(
   *   '0da2b59e-f118-439d-8097-bdfb215203c9',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  update(
    policyId: string,
    params: PolicyUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/alerting/v3/policies/${policyId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PolicyUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get a list of all Notification policies.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const policy of client.alerting.policies.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(
    params: PolicyListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PoliciesSinglePage, Policy> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/alerting/v3/policies`,
      PoliciesSinglePage,
      options,
    );
  }

  /**
   * Delete a Notification policy.
   *
   * @example
   * ```ts
   * const policy = await client.alerting.policies.delete(
   *   '0da2b59e-f118-439d-8097-bdfb215203c9',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    policyId: string,
    params: PolicyDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PolicyDeleteResponse> {
    const { account_id } = params;
    return this._client.delete(`/accounts/${account_id}/alerting/v3/policies/${policyId}`, options);
  }

  /**
   * Get details for a single policy.
   *
   * @example
   * ```ts
   * const policy = await client.alerting.policies.get(
   *   '0da2b59e-f118-439d-8097-bdfb215203c9',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(policyId: string, params: PolicyGetParams, options?: Core.RequestOptions): Core.APIPromise<Policy> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/alerting/v3/policies/${policyId}`,
        options,
      ) as Core.APIPromise<{ result: Policy }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PoliciesSinglePage extends SinglePage<Policy> {}

/**
 * List of IDs that will be used when dispatching a notification. IDs for email
 * type will be the email address.
 */
export interface Mechanism {
  email?: Array<Mechanism.Email>;

  pagerduty?: Array<Mechanism.Pagerduty>;

  webhooks?: Array<Mechanism.Webhook>;
}

export namespace Mechanism {
  export interface Email {
    /**
     * The email address
     */
    id?: string;
  }

  export interface Pagerduty {
    /**
     * UUID
     */
    id?: string;
  }

  export interface Webhook {
    /**
     * UUID
     */
    id?: string;
  }
}

/**
 * List of IDs that will be used when dispatching a notification. IDs for email
 * type will be the email address.
 */
export interface MechanismParam {
  email?: Array<MechanismParam.Email>;

  pagerduty?: Array<MechanismParam.Pagerduty>;

  webhooks?: Array<MechanismParam.Webhook>;
}

export namespace MechanismParam {
  export interface Email {
    /**
     * The email address
     */
    id?: string;
  }

  export interface Pagerduty {
    /**
     * UUID
     */
    id?: string;
  }

  export interface Webhook {
    /**
     * UUID
     */
    id?: string;
  }
}

export interface Policy {
  /**
   * The unique identifier of a notification policy
   */
  id?: string;

  /**
   * Optional specification of how often to re-alert from the same incident, not
   * support on all alert types.
   */
  alert_interval?: string;

  /**
   * Refers to which event will trigger a Notification dispatch. You can use the
   * endpoint to get available alert types which then will give you a list of
   * possible values.
   */
  alert_type?:
    | 'access_custom_certificate_expiration_type'
    | 'advanced_ddos_attack_l4_alert'
    | 'advanced_ddos_attack_l7_alert'
    | 'advanced_http_alert_error'
    | 'bgp_hijack_notification'
    | 'billing_usage_alert'
    | 'block_notification_block_removed'
    | 'block_notification_new_block'
    | 'block_notification_review_rejected'
    | 'bot_traffic_basic_alert'
    | 'brand_protection_alert'
    | 'brand_protection_digest'
    | 'clickhouse_alert_fw_anomaly'
    | 'clickhouse_alert_fw_ent_anomaly'
    | 'cloudforce_one_request_notification'
    | 'custom_analytics'
    | 'custom_bot_detection_alert'
    | 'custom_ssl_certificate_event_type'
    | 'dedicated_ssl_certificate_event_type'
    | 'device_connectivity_anomaly_alert'
    | 'dos_attack_l4'
    | 'dos_attack_l7'
    | 'expiring_service_token_alert'
    | 'failing_logpush_job_disabled_alert'
    | 'fbm_auto_advertisement'
    | 'fbm_dosd_attack'
    | 'fbm_volumetric_attack'
    | 'health_check_status_notification'
    | 'hostname_aop_custom_certificate_expiration_type'
    | 'http_alert_edge_error'
    | 'http_alert_origin_error'
    | 'image_notification'
    | 'image_resizing_notification'
    | 'incident_alert'
    | 'load_balancing_health_alert'
    | 'load_balancing_pool_enablement_alert'
    | 'logo_match_alert'
    | 'magic_tunnel_health_check_event'
    | 'magic_wan_tunnel_health'
    | 'maintenance_event_notification'
    | 'mtls_certificate_store_certificate_expiration_type'
    | 'pages_event_alert'
    | 'radar_notification'
    | 'real_origin_monitoring'
    | 'scriptmonitor_alert_new_code_change_detections'
    | 'scriptmonitor_alert_new_hosts'
    | 'scriptmonitor_alert_new_malicious_hosts'
    | 'scriptmonitor_alert_new_malicious_scripts'
    | 'scriptmonitor_alert_new_malicious_url'
    | 'scriptmonitor_alert_new_max_length_resource_url'
    | 'scriptmonitor_alert_new_resources'
    | 'secondary_dns_all_primaries_failing'
    | 'secondary_dns_primaries_failing'
    | 'secondary_dns_warning'
    | 'secondary_dns_zone_successfully_updated'
    | 'secondary_dns_zone_validation_warning'
    | 'security_insights_alert'
    | 'sentinel_alert'
    | 'stream_live_notifications'
    | 'synthetic_test_latency_alert'
    | 'synthetic_test_low_availability_alert'
    | 'traffic_anomalies_alert'
    | 'tunnel_health_event'
    | 'tunnel_update_event'
    | 'universal_ssl_event_type'
    | 'web_analytics_metrics_update'
    | 'zone_aop_custom_certificate_expiration_type';

  created?: string;

  /**
   * Optional description for the Notification policy.
   */
  description?: string;

  /**
   * Whether or not the Notification policy is enabled.
   */
  enabled?: boolean;

  /**
   * Optional filters that allow you to be alerted only on a subset of events for
   * that alert type based on some criteria. This is only available for select alert
   * types. See alert type documentation for more details.
   */
  filters?: PolicyFilter;

  /**
   * List of IDs that will be used when dispatching a notification. IDs for email
   * type will be the email address.
   */
  mechanisms?: Mechanism;

  modified?: string;

  /**
   * Name of the policy.
   */
  name?: string;
}

/**
 * Optional filters that allow you to be alerted only on a subset of events for
 * that alert type based on some criteria. This is only available for select alert
 * types. See alert type documentation for more details.
 */
export interface PolicyFilter {
  /**
   * Usage depends on specific alert type
   */
  actions?: Array<string>;

  /**
   * Used for configuring radar_notification
   */
  affected_asns?: Array<string>;

  /**
   * Used for configuring incident_alert
   */
  affected_components?: Array<string>;

  /**
   * Used for configuring radar_notification
   */
  affected_locations?: Array<string>;

  /**
   * Used for configuring maintenance_event_notification
   */
  airport_code?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  alert_trigger_preferences?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  alert_trigger_preferences_value?: Array<string>;

  /**
   * Used for configuring load_balancing_pool_enablement_alert
   */
  enabled?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  environment?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  event?: Array<string>;

  /**
   * Used for configuring load_balancing_health_alert
   */
  event_source?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  event_type?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  group_by?: Array<string>;

  /**
   * Used for configuring health_check_status_notification
   */
  health_check_id?: Array<string>;

  /**
   * Used for configuring incident_alert
   */
  incident_impact?: Array<
    'INCIDENT_IMPACT_NONE' | 'INCIDENT_IMPACT_MINOR' | 'INCIDENT_IMPACT_MAJOR' | 'INCIDENT_IMPACT_CRITICAL'
  >;

  /**
   * Used for configuring stream_live_notifications
   */
  input_id?: Array<string>;

  /**
   * Used for configuring security_insights_alert
   */
  insight_class?: Array<string>;

  /**
   * Used for configuring billing_usage_alert
   */
  limit?: Array<string>;

  /**
   * Used for configuring logo_match_alert
   */
  logo_tag?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  megabits_per_second?: Array<string>;

  /**
   * Used for configuring load_balancing_health_alert
   */
  new_health?: Array<string>;

  /**
   * Used for configuring tunnel_health_event
   */
  new_status?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  packets_per_second?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  pool_id?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  pop_names?: Array<string>;

  /**
   * Used for configuring billing_usage_alert
   */
  product?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  project_id?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  protocol?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  query_tag?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  requests_per_second?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  selectors?: Array<string>;

  /**
   * Used for configuring clickhouse_alert_fw_ent_anomaly
   */
  services?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  slo?: Array<string>;

  /**
   * Used for configuring health_check_status_notification
   */
  status?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  target_hostname?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  target_ip?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  target_zone_name?: Array<string>;

  /**
   * Used for configuring traffic_anomalies_alert
   */
  traffic_exclusions?: Array<'security_events'>;

  /**
   * Used for configuring tunnel_health_event
   */
  tunnel_id?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  tunnel_name?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  where?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  zones?: Array<string>;
}

/**
 * Optional filters that allow you to be alerted only on a subset of events for
 * that alert type based on some criteria. This is only available for select alert
 * types. See alert type documentation for more details.
 */
export interface PolicyFilterParam {
  /**
   * Usage depends on specific alert type
   */
  actions?: Array<string>;

  /**
   * Used for configuring radar_notification
   */
  affected_asns?: Array<string>;

  /**
   * Used for configuring incident_alert
   */
  affected_components?: Array<string>;

  /**
   * Used for configuring radar_notification
   */
  affected_locations?: Array<string>;

  /**
   * Used for configuring maintenance_event_notification
   */
  airport_code?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  alert_trigger_preferences?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  alert_trigger_preferences_value?: Array<string>;

  /**
   * Used for configuring load_balancing_pool_enablement_alert
   */
  enabled?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  environment?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  event?: Array<string>;

  /**
   * Used for configuring load_balancing_health_alert
   */
  event_source?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  event_type?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  group_by?: Array<string>;

  /**
   * Used for configuring health_check_status_notification
   */
  health_check_id?: Array<string>;

  /**
   * Used for configuring incident_alert
   */
  incident_impact?: Array<
    'INCIDENT_IMPACT_NONE' | 'INCIDENT_IMPACT_MINOR' | 'INCIDENT_IMPACT_MAJOR' | 'INCIDENT_IMPACT_CRITICAL'
  >;

  /**
   * Used for configuring stream_live_notifications
   */
  input_id?: Array<string>;

  /**
   * Used for configuring security_insights_alert
   */
  insight_class?: Array<string>;

  /**
   * Used for configuring billing_usage_alert
   */
  limit?: Array<string>;

  /**
   * Used for configuring logo_match_alert
   */
  logo_tag?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  megabits_per_second?: Array<string>;

  /**
   * Used for configuring load_balancing_health_alert
   */
  new_health?: Array<string>;

  /**
   * Used for configuring tunnel_health_event
   */
  new_status?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  packets_per_second?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  pool_id?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  pop_names?: Array<string>;

  /**
   * Used for configuring billing_usage_alert
   */
  product?: Array<string>;

  /**
   * Used for configuring pages_event_alert
   */
  project_id?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  protocol?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  query_tag?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  requests_per_second?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  selectors?: Array<string>;

  /**
   * Used for configuring clickhouse_alert_fw_ent_anomaly
   */
  services?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  slo?: Array<string>;

  /**
   * Used for configuring health_check_status_notification
   */
  status?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  target_hostname?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l4_alert
   */
  target_ip?: Array<string>;

  /**
   * Used for configuring advanced_ddos_attack_l7_alert
   */
  target_zone_name?: Array<string>;

  /**
   * Used for configuring traffic_anomalies_alert
   */
  traffic_exclusions?: Array<'security_events'>;

  /**
   * Used for configuring tunnel_health_event
   */
  tunnel_id?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  tunnel_name?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  where?: Array<string>;

  /**
   * Usage depends on specific alert type
   */
  zones?: Array<string>;
}

export interface PolicyCreateResponse {
  /**
   * UUID
   */
  id?: string;
}

export interface PolicyUpdateResponse {
  /**
   * UUID
   */
  id?: string;
}

export interface PolicyDeleteResponse {
  errors: Array<Shared.ResponseInfo>;

  messages: Array<Shared.ResponseInfo>;

  /**
   * Whether the API call was successful
   */
  success: true;

  result_info?: PolicyDeleteResponse.ResultInfo;
}

export namespace PolicyDeleteResponse {
  export interface ResultInfo {
    /**
     * Total number of results for the requested service
     */
    count?: number;

    /**
     * Current page within paginated list of results
     */
    page?: number;

    /**
     * Number of results per page of results
     */
    per_page?: number;

    /**
     * Total results available without any search parameters
     */
    total_count?: number;
  }
}

export interface PolicyCreateParams {
  /**
   * Path param: The account id
   */
  account_id: string;

  /**
   * Body param: Refers to which event will trigger a Notification dispatch. You can
   * use the endpoint to get available alert types which then will give you a list of
   * possible values.
   */
  alert_type:
    | 'access_custom_certificate_expiration_type'
    | 'advanced_ddos_attack_l4_alert'
    | 'advanced_ddos_attack_l7_alert'
    | 'advanced_http_alert_error'
    | 'bgp_hijack_notification'
    | 'billing_usage_alert'
    | 'block_notification_block_removed'
    | 'block_notification_new_block'
    | 'block_notification_review_rejected'
    | 'bot_traffic_basic_alert'
    | 'brand_protection_alert'
    | 'brand_protection_digest'
    | 'clickhouse_alert_fw_anomaly'
    | 'clickhouse_alert_fw_ent_anomaly'
    | 'cloudforce_one_request_notification'
    | 'custom_analytics'
    | 'custom_bot_detection_alert'
    | 'custom_ssl_certificate_event_type'
    | 'dedicated_ssl_certificate_event_type'
    | 'device_connectivity_anomaly_alert'
    | 'dos_attack_l4'
    | 'dos_attack_l7'
    | 'expiring_service_token_alert'
    | 'failing_logpush_job_disabled_alert'
    | 'fbm_auto_advertisement'
    | 'fbm_dosd_attack'
    | 'fbm_volumetric_attack'
    | 'health_check_status_notification'
    | 'hostname_aop_custom_certificate_expiration_type'
    | 'http_alert_edge_error'
    | 'http_alert_origin_error'
    | 'image_notification'
    | 'image_resizing_notification'
    | 'incident_alert'
    | 'load_balancing_health_alert'
    | 'load_balancing_pool_enablement_alert'
    | 'logo_match_alert'
    | 'magic_tunnel_health_check_event'
    | 'magic_wan_tunnel_health'
    | 'maintenance_event_notification'
    | 'mtls_certificate_store_certificate_expiration_type'
    | 'pages_event_alert'
    | 'radar_notification'
    | 'real_origin_monitoring'
    | 'scriptmonitor_alert_new_code_change_detections'
    | 'scriptmonitor_alert_new_hosts'
    | 'scriptmonitor_alert_new_malicious_hosts'
    | 'scriptmonitor_alert_new_malicious_scripts'
    | 'scriptmonitor_alert_new_malicious_url'
    | 'scriptmonitor_alert_new_max_length_resource_url'
    | 'scriptmonitor_alert_new_resources'
    | 'secondary_dns_all_primaries_failing'
    | 'secondary_dns_primaries_failing'
    | 'secondary_dns_warning'
    | 'secondary_dns_zone_successfully_updated'
    | 'secondary_dns_zone_validation_warning'
    | 'security_insights_alert'
    | 'sentinel_alert'
    | 'stream_live_notifications'
    | 'synthetic_test_latency_alert'
    | 'synthetic_test_low_availability_alert'
    | 'traffic_anomalies_alert'
    | 'tunnel_health_event'
    | 'tunnel_update_event'
    | 'universal_ssl_event_type'
    | 'web_analytics_metrics_update'
    | 'zone_aop_custom_certificate_expiration_type';

  /**
   * Body param: Whether or not the Notification policy is enabled.
   */
  enabled: boolean;

  /**
   * Body param: List of IDs that will be used when dispatching a notification. IDs
   * for email type will be the email address.
   */
  mechanisms: MechanismParam;

  /**
   * Body param: Name of the policy.
   */
  name: string;

  /**
   * Body param: Optional specification of how often to re-alert from the same
   * incident, not support on all alert types.
   */
  alert_interval?: string;

  /**
   * Body param: Optional description for the Notification policy.
   */
  description?: string;

  /**
   * Body param: Optional filters that allow you to be alerted only on a subset of
   * events for that alert type based on some criteria. This is only available for
   * select alert types. See alert type documentation for more details.
   */
  filters?: PolicyFilterParam;
}

export interface PolicyUpdateParams {
  /**
   * Path param: The account id
   */
  account_id: string;

  /**
   * Body param: Optional specification of how often to re-alert from the same
   * incident, not support on all alert types.
   */
  alert_interval?: string;

  /**
   * Body param: Refers to which event will trigger a Notification dispatch. You can
   * use the endpoint to get available alert types which then will give you a list of
   * possible values.
   */
  alert_type?:
    | 'access_custom_certificate_expiration_type'
    | 'advanced_ddos_attack_l4_alert'
    | 'advanced_ddos_attack_l7_alert'
    | 'advanced_http_alert_error'
    | 'bgp_hijack_notification'
    | 'billing_usage_alert'
    | 'block_notification_block_removed'
    | 'block_notification_new_block'
    | 'block_notification_review_rejected'
    | 'bot_traffic_basic_alert'
    | 'brand_protection_alert'
    | 'brand_protection_digest'
    | 'clickhouse_alert_fw_anomaly'
    | 'clickhouse_alert_fw_ent_anomaly'
    | 'cloudforce_one_request_notification'
    | 'custom_analytics'
    | 'custom_bot_detection_alert'
    | 'custom_ssl_certificate_event_type'
    | 'dedicated_ssl_certificate_event_type'
    | 'device_connectivity_anomaly_alert'
    | 'dos_attack_l4'
    | 'dos_attack_l7'
    | 'expiring_service_token_alert'
    | 'failing_logpush_job_disabled_alert'
    | 'fbm_auto_advertisement'
    | 'fbm_dosd_attack'
    | 'fbm_volumetric_attack'
    | 'health_check_status_notification'
    | 'hostname_aop_custom_certificate_expiration_type'
    | 'http_alert_edge_error'
    | 'http_alert_origin_error'
    | 'image_notification'
    | 'image_resizing_notification'
    | 'incident_alert'
    | 'load_balancing_health_alert'
    | 'load_balancing_pool_enablement_alert'
    | 'logo_match_alert'
    | 'magic_tunnel_health_check_event'
    | 'magic_wan_tunnel_health'
    | 'maintenance_event_notification'
    | 'mtls_certificate_store_certificate_expiration_type'
    | 'pages_event_alert'
    | 'radar_notification'
    | 'real_origin_monitoring'
    | 'scriptmonitor_alert_new_code_change_detections'
    | 'scriptmonitor_alert_new_hosts'
    | 'scriptmonitor_alert_new_malicious_hosts'
    | 'scriptmonitor_alert_new_malicious_scripts'
    | 'scriptmonitor_alert_new_malicious_url'
    | 'scriptmonitor_alert_new_max_length_resource_url'
    | 'scriptmonitor_alert_new_resources'
    | 'secondary_dns_all_primaries_failing'
    | 'secondary_dns_primaries_failing'
    | 'secondary_dns_warning'
    | 'secondary_dns_zone_successfully_updated'
    | 'secondary_dns_zone_validation_warning'
    | 'security_insights_alert'
    | 'sentinel_alert'
    | 'stream_live_notifications'
    | 'synthetic_test_latency_alert'
    | 'synthetic_test_low_availability_alert'
    | 'traffic_anomalies_alert'
    | 'tunnel_health_event'
    | 'tunnel_update_event'
    | 'universal_ssl_event_type'
    | 'web_analytics_metrics_update'
    | 'zone_aop_custom_certificate_expiration_type';

  /**
   * Body param: Optional description for the Notification policy.
   */
  description?: string;

  /**
   * Body param: Whether or not the Notification policy is enabled.
   */
  enabled?: boolean;

  /**
   * Body param: Optional filters that allow you to be alerted only on a subset of
   * events for that alert type based on some criteria. This is only available for
   * select alert types. See alert type documentation for more details.
   */
  filters?: PolicyFilterParam;

  /**
   * Body param: List of IDs that will be used when dispatching a notification. IDs
   * for email type will be the email address.
   */
  mechanisms?: MechanismParam;

  /**
   * Body param: Name of the policy.
   */
  name?: string;
}

export interface PolicyListParams {
  /**
   * The account id
   */
  account_id: string;
}

export interface PolicyDeleteParams {
  /**
   * The account id
   */
  account_id: string;
}

export interface PolicyGetParams {
  /**
   * The account id
   */
  account_id: string;
}

Policies.PoliciesSinglePage = PoliciesSinglePage;

export declare namespace Policies {
  export {
    type Mechanism as Mechanism,
    type Policy as Policy,
    type PolicyFilter as PolicyFilter,
    type PolicyCreateResponse as PolicyCreateResponse,
    type PolicyUpdateResponse as PolicyUpdateResponse,
    type PolicyDeleteResponse as PolicyDeleteResponse,
    PoliciesSinglePage as PoliciesSinglePage,
    type PolicyCreateParams as PolicyCreateParams,
    type PolicyUpdateParams as PolicyUpdateParams,
    type PolicyListParams as PolicyListParams,
    type PolicyDeleteParams as PolicyDeleteParams,
    type PolicyGetParams as PolicyGetParams,
  };
}
