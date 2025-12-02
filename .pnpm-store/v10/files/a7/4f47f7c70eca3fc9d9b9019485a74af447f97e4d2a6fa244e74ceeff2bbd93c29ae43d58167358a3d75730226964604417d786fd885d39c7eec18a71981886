// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';
import * as Shared from './shared';
import { AuditLogsV4PagePaginationArray } from './shared';
import { type V4PagePaginationArrayParams } from '../pagination';

export class AuditLogs extends APIResource {
  /**
   * Gets a list of audit logs for an account. Can be filtered by who made the
   * change, on which zone, and the timeframe of the change.
   */
  list(
    params: AuditLogListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<AuditLogsV4PagePaginationArray, Shared.AuditLog> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(`/accounts/${account_id}/audit_logs`, AuditLogsV4PagePaginationArray, {
      query,
      ...options,
    });
  }
}

export interface AuditLogListParams extends V4PagePaginationArrayParams {
  /**
   * Path param: Identifier
   */
  account_id: string;

  /**
   * Query param: Finds a specific log by its ID.
   */
  id?: string;

  /**
   * Query param:
   */
  action?: AuditLogListParams.Action;

  /**
   * Query param:
   */
  actor?: AuditLogListParams.Actor;

  /**
   * Query param: Limits the returned results to logs older than the specified date.
   * A `full-date` that conforms to RFC3339.
   */
  before?: (string & {}) | (string & {});

  /**
   * Query param: Changes the direction of the chronological sorting.
   */
  direction?: 'desc' | 'asc';

  /**
   * Query param: Indicates that this request is an export of logs in CSV format.
   */
  export?: boolean;

  /**
   * Query param: Indicates whether or not to hide user level audit logs.
   */
  hide_user_logs?: boolean;

  /**
   * Query param: Limits the returned results to logs newer than the specified date.
   * A `full-date` that conforms to RFC3339.
   */
  since?: (string & {}) | (string & {});

  /**
   * Query param:
   */
  zone?: AuditLogListParams.Zone;
}

export namespace AuditLogListParams {
  export interface Action {
    /**
     * Filters by the action type.
     */
    type?: string;
  }

  export interface Actor {
    /**
     * Filters by the email address of the actor that made the change.
     */
    email?: string;

    /**
     * Filters by the IP address of the request that made the change by specific IP
     * address or valid CIDR Range.
     */
    ip?: string;
  }

  export interface Zone {
    /**
     * Filters by the name of the zone associated to the change.
     */
    name?: string;
  }
}

export declare namespace AuditLogs {
  export { type AuditLogListParams as AuditLogListParams };
}

export { AuditLogsV4PagePaginationArray };
