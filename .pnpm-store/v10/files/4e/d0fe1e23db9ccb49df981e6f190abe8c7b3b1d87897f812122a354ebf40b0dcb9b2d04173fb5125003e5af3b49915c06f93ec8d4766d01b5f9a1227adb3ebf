// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { CursorLimitPagination, type CursorLimitPaginationParams } from '../../../pagination';

export class Objects extends APIResource {
  /**
   * Returns the Durable Objects in a given namespace.
   */
  list(
    id: string,
    params: ObjectListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DurableObjectsCursorLimitPagination, DurableObject> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/durable_objects/namespaces/${id}/objects`,
      DurableObjectsCursorLimitPagination,
      { query, ...options },
    );
  }
}

export class DurableObjectsCursorLimitPagination extends CursorLimitPagination<DurableObject> {}

export interface DurableObject {
  /**
   * ID of the Durable Object.
   */
  id?: string;

  /**
   * Whether the Durable Object has stored data.
   */
  hasStoredData?: boolean;
}

export interface ObjectListParams extends CursorLimitPaginationParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;
}

Objects.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;

export declare namespace Objects {
  export {
    type DurableObject as DurableObject,
    DurableObjectsCursorLimitPagination as DurableObjectsCursorLimitPagination,
    type ObjectListParams as ObjectListParams,
  };
}
