// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as QueuesAPI from './queues';

export class Purge extends APIResource {
  /**
   * Deletes all messages from the Queue.
   *
   * @example
   * ```ts
   * const queue = await client.queues.purge.start(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  start(
    queueId: string,
    params: PurgeStartParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<QueuesAPI.Queue> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/queues/${queueId}/purge`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: QueuesAPI.Queue }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get details about a Queue's purge status.
   *
   * @example
   * ```ts
   * const response = await client.queues.purge.status(
   *   '023e105f4ecef8ad9ca31a8372d0c353',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  status(
    queueId: string,
    params: PurgeStatusParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PurgeStatusResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/queues/${queueId}/purge`, options) as Core.APIPromise<{
        result: PurgeStatusResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface PurgeStatusResponse {
  /**
   * Indicates if the last purge operation completed successfully.
   */
  completed?: string;

  /**
   * Timestamp when the last purge operation started.
   */
  started_at?: string;
}

export interface PurgeStartParams {
  /**
   * Path param: A Resource identifier.
   */
  account_id: string;

  /**
   * Body param: Confimation that all messages will be deleted permanently.
   */
  delete_messages_permanently?: boolean;
}

export interface PurgeStatusParams {
  /**
   * A Resource identifier.
   */
  account_id: string;
}

export declare namespace Purge {
  export {
    type PurgeStatusResponse as PurgeStatusResponse,
    type PurgeStartParams as PurgeStartParams,
    type PurgeStatusParams as PurgeStatusParams,
  };
}
