// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Schedules extends APIResource {
  /**
   * Updates Cron Triggers for a Worker.
   *
   * @example
   * ```ts
   * const schedule =
   *   await client.workers.scripts.schedules.update(
   *     'this-is_my_script-01',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       body: [{ cron: '* /30 * * * *' }],
   *     },
   *   );
   * ```
   */
  update(
    scriptName: string,
    params: ScheduleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScheduleUpdateResponse> {
    const { account_id, body } = params;
    return (
      this._client.put(`/accounts/${account_id}/workers/scripts/${scriptName}/schedules`, {
        body: body,
        ...options,
      }) as Core.APIPromise<{ result: ScheduleUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches Cron Triggers for a Worker.
   *
   * @example
   * ```ts
   * const schedule = await client.workers.scripts.schedules.get(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    scriptName: string,
    params: ScheduleGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScheduleGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/schedules`,
        options,
      ) as Core.APIPromise<{ result: ScheduleGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface ScheduleUpdateResponse {
  schedules: Array<ScheduleUpdateResponse.Schedule>;
}

export namespace ScheduleUpdateResponse {
  export interface Schedule {
    cron: string;

    created_on?: string;

    modified_on?: string;
  }
}

export interface ScheduleGetResponse {
  schedules: Array<ScheduleGetResponse.Schedule>;
}

export namespace ScheduleGetResponse {
  export interface Schedule {
    cron: string;

    created_on?: string;

    modified_on?: string;
  }
}

export interface ScheduleUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param:
   */
  body: Array<ScheduleUpdateParams.Body>;
}

export namespace ScheduleUpdateParams {
  export interface Body {
    cron: string;
  }
}

export interface ScheduleGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export declare namespace Schedules {
  export {
    type ScheduleUpdateResponse as ScheduleUpdateResponse,
    type ScheduleGetResponse as ScheduleGetResponse,
    type ScheduleUpdateParams as ScheduleUpdateParams,
    type ScheduleGetParams as ScheduleGetParams,
  };
}
