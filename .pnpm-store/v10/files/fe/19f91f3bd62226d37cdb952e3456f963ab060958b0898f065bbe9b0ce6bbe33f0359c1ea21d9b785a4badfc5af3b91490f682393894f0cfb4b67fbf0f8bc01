// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Schema extends APIResource {
  /**
   * Get Model Schema
   */
  get(params: SchemaGetParams, options?: Core.RequestOptions): Core.APIPromise<SchemaGetResponse> {
    const { account_id, ...query } = params;
    return (
      this._client.get(`/accounts/${account_id}/ai/models/schema`, { query, ...options }) as Core.APIPromise<{
        result: SchemaGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export type SchemaGetResponse = unknown;

export interface SchemaGetParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Model Name
   */
  model: string;
}

export declare namespace Schema {
  export { type SchemaGetResponse as SchemaGetResponse, type SchemaGetParams as SchemaGetParams };
}
