// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Events extends APIResource {
  /**
   * Send event to instance
   */
  create(
    workflowName: string,
    instanceId: string,
    eventType: string,
    params: EventCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EventCreateResponse> {
    const { account_id, body } = params ?? {};
    return (
      this._client.post(
        `/accounts/${account_id}/workflows/${workflowName}/instances/${instanceId}/events/${eventType}`,
        { body: body, ...options },
      ) as Core.APIPromise<{ result: EventCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type EventCreateResponse = unknown;

export interface EventCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  body?: unknown;
}

export declare namespace Events {
  export { type EventCreateResponse as EventCreateResponse, type EventCreateParams as EventCreateParams };
}
