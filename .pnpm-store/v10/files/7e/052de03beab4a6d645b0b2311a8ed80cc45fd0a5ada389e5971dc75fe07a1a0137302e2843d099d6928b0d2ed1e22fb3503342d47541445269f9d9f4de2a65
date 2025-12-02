// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class TargetIndustries extends APIResource {
  /**
   * Lists all target industries
   *
   * @example
   * ```ts
   * const targetIndustries =
   *   await client.cloudforceOne.threatEvents.targetIndustries.list(
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  list(
    params: TargetIndustryListParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<TargetIndustryListResponse> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/cloudforce-one/events/targetIndustries`, options);
  }
}

export interface TargetIndustryListResponse {
  items: TargetIndustryListResponse.Items;

  type: string;
}

export namespace TargetIndustryListResponse {
  export interface Items {
    type: string;
  }
}

export interface TargetIndustryListParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace TargetIndustries {
  export {
    type TargetIndustryListResponse as TargetIndustryListResponse,
    type TargetIndustryListParams as TargetIndustryListParams,
  };
}
