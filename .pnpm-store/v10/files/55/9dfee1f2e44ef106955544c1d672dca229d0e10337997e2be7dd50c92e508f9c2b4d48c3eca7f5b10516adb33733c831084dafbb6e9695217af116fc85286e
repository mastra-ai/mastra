// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import { isRequestOptions } from '../../../core';
import * as Core from '../../../core';
import { CloudflareError } from '../../../error';

export class Fields extends APIResource {
  /**
   * Lists all fields available for a dataset. The response result is an object with
   * key-value pairs, where keys are field names, and values are descriptions.
   *
   * @example
   * ```ts
   * const field = await client.logpush.datasets.fields.get(
   *   'gateway_dns',
   *   { account_id: 'account_id' },
   * );
   * ```
   */
  get(
    datasetId:
      | 'access_requests'
      | 'audit_logs'
      | 'biso_user_actions'
      | 'casb_findings'
      | 'device_posture_results'
      | 'dlp_forensic_copies'
      | 'dns_firewall_logs'
      | 'dns_logs'
      | 'email_security_alerts'
      | 'firewall_events'
      | 'gateway_dns'
      | 'gateway_http'
      | 'gateway_network'
      | 'http_requests'
      | 'magic_ids_detections'
      | 'nel_reports'
      | 'network_analytics_logs'
      | 'page_shield_events'
      | 'sinkhole_http_logs'
      | 'spectrum_events'
      | 'ssh_logs'
      | 'workers_trace_events'
      | 'zaraz_events'
      | 'zero_trust_network_sessions'
      | null,
    params?: FieldGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FieldGetResponse>;
  get(
    datasetId:
      | 'access_requests'
      | 'audit_logs'
      | 'biso_user_actions'
      | 'casb_findings'
      | 'device_posture_results'
      | 'dlp_forensic_copies'
      | 'dns_firewall_logs'
      | 'dns_logs'
      | 'email_security_alerts'
      | 'firewall_events'
      | 'gateway_dns'
      | 'gateway_http'
      | 'gateway_network'
      | 'http_requests'
      | 'magic_ids_detections'
      | 'nel_reports'
      | 'network_analytics_logs'
      | 'page_shield_events'
      | 'sinkhole_http_logs'
      | 'spectrum_events'
      | 'ssh_logs'
      | 'workers_trace_events'
      | 'zaraz_events'
      | 'zero_trust_network_sessions'
      | null,
    options?: Core.RequestOptions,
  ): Core.APIPromise<FieldGetResponse>;
  get(
    datasetId:
      | 'access_requests'
      | 'audit_logs'
      | 'biso_user_actions'
      | 'casb_findings'
      | 'device_posture_results'
      | 'dlp_forensic_copies'
      | 'dns_firewall_logs'
      | 'dns_logs'
      | 'email_security_alerts'
      | 'firewall_events'
      | 'gateway_dns'
      | 'gateway_http'
      | 'gateway_network'
      | 'http_requests'
      | 'magic_ids_detections'
      | 'nel_reports'
      | 'network_analytics_logs'
      | 'page_shield_events'
      | 'sinkhole_http_logs'
      | 'spectrum_events'
      | 'ssh_logs'
      | 'workers_trace_events'
      | 'zaraz_events'
      | 'zero_trust_network_sessions'
      | null,
    params: FieldGetParams | Core.RequestOptions = {},
    options?: Core.RequestOptions,
  ): Core.APIPromise<FieldGetResponse> {
    if (isRequestOptions(params)) {
      return this.get(datasetId, {}, params);
    }
    const { account_id, zone_id } = params;
    if (!account_id && !zone_id) {
      throw new CloudflareError('You must provide either account_id or zone_id.');
    }
    if (account_id && zone_id) {
      throw new CloudflareError('You cannot provide both account_id and zone_id.');
    }
    const { accountOrZone, accountOrZoneId } =
      account_id ?
        {
          accountOrZone: 'accounts',
          accountOrZoneId: account_id,
        }
      : {
          accountOrZone: 'zones',
          accountOrZoneId: zone_id,
        };
    return (
      this._client.get(
        `/${accountOrZone}/${accountOrZoneId}/logpush/datasets/${datasetId}/fields`,
        options,
      ) as Core.APIPromise<{ result: FieldGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type FieldGetResponse = unknown;

export interface FieldGetParams {
  /**
   * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
   */
  account_id?: string;

  /**
   * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
   */
  zone_id?: string;
}

export declare namespace Fields {
  export { type FieldGetResponse as FieldGetResponse, type FieldGetParams as FieldGetParams };
}
