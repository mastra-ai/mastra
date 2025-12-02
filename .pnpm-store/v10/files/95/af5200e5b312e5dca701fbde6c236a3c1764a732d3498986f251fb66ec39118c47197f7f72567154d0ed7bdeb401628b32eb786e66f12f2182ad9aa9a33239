// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';

export class Webhooks extends APIResource {
  /**
   * Creates a webhook notification.
   *
   * @example
   * ```ts
   * const webhook = await client.stream.webhooks.update({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   notificationUrl: 'https://example.com',
   * });
   * ```
   */
  update(params: WebhookUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WebhookUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/stream/webhook`, { body, ...options }) as Core.APIPromise<{
        result: WebhookUpdateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Deletes a webhook.
   *
   * @example
   * ```ts
   * const webhook = await client.stream.webhooks.delete({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  delete(params: WebhookDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WebhookDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/stream/webhook`, options) as Core.APIPromise<{
        result: WebhookDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieves a list of webhooks.
   *
   * @example
   * ```ts
   * const webhook = await client.stream.webhooks.get({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * });
   * ```
   */
  get(params: WebhookGetParams, options?: Core.RequestOptions): Core.APIPromise<WebhookGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/stream/webhook`, options) as Core.APIPromise<{
        result: WebhookGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type WebhookUpdateResponse = unknown;

export type WebhookDeleteResponse = string;

export type WebhookGetResponse = unknown;

export interface WebhookUpdateParams {
  /**
   * Path param: The account identifier tag.
   */
  account_id: string;

  /**
   * Body param: The URL where webhooks will be sent.
   */
  notificationUrl: string;
}

export interface WebhookDeleteParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export interface WebhookGetParams {
  /**
   * The account identifier tag.
   */
  account_id: string;
}

export declare namespace Webhooks {
  export {
    type WebhookUpdateResponse as WebhookUpdateResponse,
    type WebhookDeleteResponse as WebhookDeleteResponse,
    type WebhookGetResponse as WebhookGetResponse,
    type WebhookUpdateParams as WebhookUpdateParams,
    type WebhookDeleteParams as WebhookDeleteParams,
    type WebhookGetParams as WebhookGetParams,
  };
}
