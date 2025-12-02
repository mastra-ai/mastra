// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';

export class Health extends APIResource {
  /**
   * Benchmark Durable Object warmup
   *
   * @example
   * ```ts
   * const health =
   *   await client.cloudforceOne.threatEvents.datasets.health.get(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    datasetId: string,
    params: HealthGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<HealthGetResponse> {
    const { account_id } = params;
    return this._client.get(
      `/accounts/${account_id}/cloudforce-one/events/dataset/${datasetId}/health`,
      options,
    );
  }
}

export interface HealthGetResponse {
  items: HealthGetResponse.Items;

  type: string;
}

export namespace HealthGetResponse {
  export interface Items {
    type: string;
  }
}

export interface HealthGetParams {
  /**
   * Account ID.
   */
  account_id: string;
}

export declare namespace Health {
  export { type HealthGetResponse as HealthGetResponse, type HealthGetParams as HealthGetParams };
}
