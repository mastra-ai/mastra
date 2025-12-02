// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Tags extends APIResource {
  /**
   * Creates a new tag
   *
   * @example
   * ```ts
   * const tag =
   *   await client.cloudforceOne.threatEvents.tags.create({
   *     account_id: 'account_id',
   *     name: 'name',
   *   });
   * ```
   */
  create(params: TagCreateParams, options?: Core.RequestOptions): Core.APIPromise<TagCreateResponse> {
    const { account_id, ...body } = params;
    return this._client.post(`/accounts/${account_id}/cloudforce-one/events/tags/create`, {
      body,
      ...options,
    });
  }
}

export interface TagCreateResponse {
  name: string;

  uuid: string;
}

export interface TagCreateParams {
  /**
   * Path param: Account ID.
   */
  account_id: string;

  /**
   * Body param:
   */
  name: string;
}

export declare namespace Tags {
  export { type TagCreateResponse as TagCreateResponse, type TagCreateParams as TagCreateParams };
}
