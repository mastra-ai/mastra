// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Attackers extends APIResource {
  /**
   * Lists attackers
   *
   * @example
   * ```ts
   * const attackers =
   *   await client.cloudforceOne.threatEvents.attackers.list({
   *     account_id: 'account_id',
   *   });
   * ```
   */
  list(params: AttackerListParams, options?: Core.RequestOptions): Core.APIPromise<AttackerListResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/cloudforce-one/events/attackers`, options);
  }
}

export interface AttackerListResponse {
  items: AttackerListResponse.Items;

  type: string;
}

export namespace AttackerListResponse {
  export interface Items {
    type: string;
  }
}

export interface AttackerListParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace Attackers {
  export { type AttackerListResponse as AttackerListResponse, type AttackerListParams as AttackerListParams };
}
