// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as Shared from '../shared';
import { SubscriptionsSinglePage } from '../shared';

export class Subscriptions extends APIResource {
  /**
   * Updates a user's subscriptions.
   *
   * @example
   * ```ts
   * const subscription = await client.user.subscriptions.update(
   *   '506e3185e9c882d175a2d0cb0093d9f2',
   * );
   * ```
   */
  update(
    identifier: string,
    body: SubscriptionUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<SubscriptionUpdateResponse> {
    return (
      this._client.put(`/user/subscriptions/${identifier}`, { body, ...options }) as Core.APIPromise<{
        result: SubscriptionUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a user's subscription.
   *
   * @example
   * ```ts
   * const subscription = await client.user.subscriptions.delete(
   *   '506e3185e9c882d175a2d0cb0093d9f2',
   * );
   * ```
   */
  delete(identifier: string, options?: Core.RequestOptions): Core.APIPromise<SubscriptionDeleteResponse> {
    return this._client.delete(`/user/subscriptions/${identifier}`, options);
  }

  /**
   * Lists all of a user's subscriptions.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const subscription of client.user.subscriptions.get()) {
   *   // ...
   * }
   * ```
   */
  get(options?: Core.RequestOptions): Core.PagePromise<SubscriptionsSinglePage, Shared.Subscription> {
    return this._client.getAPIList('/user/subscriptions', SubscriptionsSinglePage, options);
  }
}

export type SubscriptionUpdateResponse = unknown | string | null;

export interface SubscriptionDeleteResponse {
  /**
   * Subscription identifier tag.
   */
  subscription_id?: string;
}

export interface SubscriptionUpdateParams {
  /**
   * How often the subscription is renewed automatically.
   */
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  /**
   * The rate plan applied to the subscription.
   */
  rate_plan?: Shared.RatePlanParam;
}

export declare namespace Subscriptions {
  export {
    type SubscriptionUpdateResponse as SubscriptionUpdateResponse,
    type SubscriptionDeleteResponse as SubscriptionDeleteResponse,
    type SubscriptionUpdateParams as SubscriptionUpdateParams,
  };
}

export { SubscriptionsSinglePage };
