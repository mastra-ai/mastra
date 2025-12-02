// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class References extends APIResource {
  /**
   * Get the list of resources that reference the provided monitor.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const referenceGetResponse of client.loadBalancers.monitors.references.get(
   *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    monitorId: string,
    params: ReferenceGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ReferenceGetResponsesSinglePage, ReferenceGetResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/load_balancers/monitors/${monitorId}/references`,
      ReferenceGetResponsesSinglePage,
      options,
    );
  }
}

export class ReferenceGetResponsesSinglePage extends SinglePage<ReferenceGetResponse> {}

export interface ReferenceGetResponse {
  reference_type?: '*' | 'referral' | 'referrer';

  resource_id?: string;

  resource_name?: string;

  resource_type?: string;
}

export interface ReferenceGetParams {
  /**
   * Identifier
   */
  account_id: string;
}

References.ReferenceGetResponsesSinglePage = ReferenceGetResponsesSinglePage;

export declare namespace References {
  export {
    type ReferenceGetResponse as ReferenceGetResponse,
    ReferenceGetResponsesSinglePage as ReferenceGetResponsesSinglePage,
    type ReferenceGetParams as ReferenceGetParams,
  };
}
