// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class EventTags extends APIResource {
  /**
   * Adds a tag to an event
   *
   * @example
   * ```ts
   * const eventTag =
   *   await client.cloudforceOne.threatEvents.eventTags.create(
   *     'event_id',
   *     { account_id: 'account_id', tags: ['botnet'] },
   *   );
   * ```
   */
  create(
    eventId: string,
    params: EventTagCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EventTagCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/cloudforce-one/events/event_tag/${eventId}/create`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: EventTagCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Removes a tag from an event
   *
   * @example
   * ```ts
   * const eventTag =
   *   await client.cloudforceOne.threatEvents.eventTags.delete(
   *     'event_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    eventId: string,
    params: EventTagDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EventTagDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/cloudforce-one/events/event_tag/${eventId}`,
        options,
      ) as Core.APIPromise<{ result: EventTagDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface EventTagCreateResponse {
  success: boolean;
}

export interface EventTagDeleteResponse {
  success: boolean;
}

export interface EventTagCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  tags: Array<string>;
}

export interface EventTagDeleteParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace EventTags {
  export {
    type EventTagCreateResponse as EventTagCreateResponse,
    type EventTagDeleteResponse as EventTagDeleteResponse,
    type EventTagCreateParams as EventTagCreateParams,
    type EventTagDeleteParams as EventTagDeleteParams,
  };
}
