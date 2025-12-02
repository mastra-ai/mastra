// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Insights extends APIResource {
  /**
   * Adds an insight to an event
   *
   * @example
   * ```ts
   * const insight =
   *   await client.cloudforceOne.threatEvents.insights.create(
   *     'event_id',
   *     {
   *       account_id: 'account_id',
   *       content:
   *         'Here is some additional context _in markdown_',
   *     },
   *   );
   * ```
   */
  create(
    eventId: string,
    params: InsightCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InsightCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/create`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: InsightCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes an event insight
   *
   * @example
   * ```ts
   * const insight =
   *   await client.cloudforceOne.threatEvents.insights.delete(
   *     'event_id',
   *     'insight_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    eventId: string,
    insightId: string,
    params: InsightDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InsightDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`,
        options,
      ) as Core.APIPromise<{ result: InsightDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates an event insight
   *
   * @example
   * ```ts
   * const response =
   *   await client.cloudforceOne.threatEvents.insights.edit(
   *     'event_id',
   *     'insight_id',
   *     {
   *       account_id: 'account_id',
   *       content:
   *         'Updated: Here is some additional context _in markdown_',
   *     },
   *   );
   * ```
   */
  edit(
    eventId: string,
    insightId: string,
    params: InsightEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InsightEditResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.patch(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: InsightEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Reads an event insight
   *
   * @example
   * ```ts
   * const insight =
   *   await client.cloudforceOne.threatEvents.insights.get(
   *     'event_id',
   *     'insight_id',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    eventId: string,
    insightId: string,
    params: InsightGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<InsightGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`,
        options,
      ) as Core.APIPromise<{ result: InsightGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface InsightCreateResponse {
  content: string;

  uuid: string;
}

export interface InsightDeleteResponse {
  success: boolean;
}

export interface InsightEditResponse {
  content: string;

  uuid: string;
}

export interface InsightGetResponse {
  content: string;

  uuid: string;
}

export interface InsightCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  content: string;
}

export interface InsightDeleteParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export interface InsightEditParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  content: string;
}

export interface InsightGetParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace Insights {
  export {
    type InsightCreateResponse as InsightCreateResponse,
    type InsightDeleteResponse as InsightDeleteResponse,
    type InsightEditResponse as InsightEditResponse,
    type InsightGetResponse as InsightGetResponse,
    type InsightCreateParams as InsightCreateParams,
    type InsightDeleteParams as InsightDeleteParams,
    type InsightEditParams as InsightEditParams,
    type InsightGetParams as InsightGetParams,
  };
}
