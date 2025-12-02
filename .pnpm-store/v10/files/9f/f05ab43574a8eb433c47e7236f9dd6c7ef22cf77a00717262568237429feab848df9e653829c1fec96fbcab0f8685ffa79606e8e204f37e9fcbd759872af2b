// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as SchemaAPI from './schema';
import { Schema, SchemaGetParams, SchemaGetResponse } from './schema';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class Models extends APIResource {
  schema: SchemaAPI.Schema = new SchemaAPI.Schema(this._client);

  /**
   * Model Search
   */
  list(
    params: ModelListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<ModelListResponsesV4PagePaginationArray, ModelListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai/models/search`,
      ModelListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class ModelListResponsesV4PagePaginationArray extends V4PagePaginationArray<ModelListResponse> {}

export type ModelListResponse = unknown;

export interface ModelListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Filter by Author
   */
  author?: string;

  /**
   * Query param: Filter to hide experimental models
   */
  hide_experimental?: boolean;

  /**
   * Query param: Search
   */
  search?: string;

  /**
   * Query param: Filter by Source Id
   */
  source?: number;

  /**
   * Query param: Filter by Task Name
   */
  task?: string;
}

Models.ModelListResponsesV4PagePaginationArray = ModelListResponsesV4PagePaginationArray;
Models.Schema = Schema;

export declare namespace Models {
  export {
    type ModelListResponse as ModelListResponse,
    ModelListResponsesV4PagePaginationArray as ModelListResponsesV4PagePaginationArray,
    type ModelListParams as ModelListParams,
  };

  export {
    Schema as Schema,
    type SchemaGetResponse as SchemaGetResponse,
    type SchemaGetParams as SchemaGetParams,
  };
}
