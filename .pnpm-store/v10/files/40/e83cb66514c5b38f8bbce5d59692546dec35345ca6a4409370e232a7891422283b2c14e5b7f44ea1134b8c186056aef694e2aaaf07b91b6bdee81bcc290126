// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Crons extends APIResource {
  /**
   * Reads the last cron update time
   *
   * @example
   * ```ts
   * const crons =
   *   await client.cloudforceOne.threatEvents.crons.list({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  list(params: CronListParams, options?: Core.RequestOptions): Core.APIPromise<CronListResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/cloudforce-one/events/cron`, options);
  }

  /**
   * Reads the last cron update time
   *
   * @example
   * ```ts
   * const response =
   *   await client.cloudforceOne.threatEvents.crons.edit({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  edit(params: CronEditParams, options?: Core.RequestOptions): Core.APIPromise<CronEditResponse> {
    const { account_id } = params;
    return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/cron`, options);
  }
}

export interface CronListResponse {
  update: string;
}

export interface CronEditResponse {
  id: number;

  update: string;
}

export interface CronListParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export interface CronEditParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace Crons {
  export {
    type CronListResponse as CronListResponse,
    type CronEditResponse as CronEditResponse,
    type CronListParams as CronListParams,
    type CronEditParams as CronEditParams,
  };
}
