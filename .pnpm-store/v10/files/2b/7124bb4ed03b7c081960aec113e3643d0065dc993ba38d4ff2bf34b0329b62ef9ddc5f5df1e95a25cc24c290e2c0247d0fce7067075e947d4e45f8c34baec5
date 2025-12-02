// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Datasets extends APIResource {
  /**
   * Create a new Dataset
   *
   * @example
   * ```ts
   * const dataset = await client.aiGateway.datasets.create(
   *   'my-gateway',
   *   {
   *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   *     enable: true,
   *     filters: [
   *       {
   *         key: 'created_at',
   *         operator: 'eq',
   *         value: ['string'],
   *       },
   *     ],
   *     name: 'name',
   *   },
   * );
   * ```
   */
  create(
    gatewayId: string,
    params: DatasetCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DatasetCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: DatasetCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Dataset
   *
   * @example
   * ```ts
   * const dataset = await client.aiGateway.datasets.update(
   *   'my-gateway',
   *   'id',
   *   {
   *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   *     enable: true,
   *     filters: [
   *       {
   *         key: 'created_at',
   *         operator: 'eq',
   *         value: ['string'],
   *       },
   *     ],
   *     name: 'name',
   *   },
   * );
   * ```
   */
  update(
    gatewayId: string,
    id: string,
    params: DatasetUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DatasetUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: DatasetUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Datasets
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const datasetListResponse of client.aiGateway.datasets.list(
   *   'my-gateway',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    gatewayId: string,
    params: DatasetListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<DatasetListResponsesV4PagePaginationArray, DatasetListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets`,
      DatasetListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a Dataset
   *
   * @example
   * ```ts
   * const dataset = await client.aiGateway.datasets.delete(
   *   'my-gateway',
   *   'id',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * );
   * ```
   */
  delete(
    gatewayId: string,
    id: string,
    params: DatasetDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DatasetDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`,
        options,
      ) as Core.APIPromise<{ result: DatasetDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a Dataset
   *
   * @example
   * ```ts
   * const dataset = await client.aiGateway.datasets.get(
   *   'my-gateway',
   *   'id',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * );
   * ```
   */
  get(
    gatewayId: string,
    id: string,
    params: DatasetGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<DatasetGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/datasets/${id}`,
        options,
      ) as Core.APIPromise<{ result: DatasetGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class DatasetListResponsesV4PagePaginationArray extends V4PagePaginationArray<DatasetListResponse> {}

export interface DatasetCreateResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  enable: boolean;

  filters: Array<DatasetCreateResponse.Filter>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;
}

export namespace DatasetCreateResponse {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetUpdateResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  enable: boolean;

  filters: Array<DatasetUpdateResponse.Filter>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;
}

export namespace DatasetUpdateResponse {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetListResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  enable: boolean;

  filters: Array<DatasetListResponse.Filter>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;
}

export namespace DatasetListResponse {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetDeleteResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  enable: boolean;

  filters: Array<DatasetDeleteResponse.Filter>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;
}

export namespace DatasetDeleteResponse {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetGetResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  enable: boolean;

  filters: Array<DatasetGetResponse.Filter>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;
}

export namespace DatasetGetResponse {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  enable: boolean;

  /**
   * Body param:
   */
  filters: Array<DatasetCreateParams.Filter>;

  /**
   * Body param:
   */
  name: string;
}

export namespace DatasetCreateParams {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  enable: boolean;

  /**
   * Body param:
   */
  filters: Array<DatasetUpdateParams.Filter>;

  /**
   * Body param:
   */
  name: string;
}

export namespace DatasetUpdateParams {
  export interface Filter {
    key:
      | 'created_at'
      | 'request_content_type'
      | 'response_content_type'
      | 'success'
      | 'cached'
      | 'provider'
      | 'model'
      | 'cost'
      | 'tokens'
      | 'tokens_in'
      | 'tokens_out'
      | 'duration'
      | 'feedback';

    operator: 'eq' | 'contains' | 'lt' | 'gt';

    value: Array<string | number | boolean>;
  }
}

export interface DatasetListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  enable?: boolean;

  /**
   * Query param:
   */
  name?: string;

  /**
   * Query param: Search by id, name, filters
   */
  search?: string;
}

export interface DatasetDeleteParams {
  account_id: string;
}

export interface DatasetGetParams {
  account_id: string;
}

Datasets.DatasetListResponsesV4PagePaginationArray = DatasetListResponsesV4PagePaginationArray;

export declare namespace Datasets {
  export {
    type DatasetCreateResponse as DatasetCreateResponse,
    type DatasetUpdateResponse as DatasetUpdateResponse,
    type DatasetListResponse as DatasetListResponse,
    type DatasetDeleteResponse as DatasetDeleteResponse,
    type DatasetGetResponse as DatasetGetResponse,
    DatasetListResponsesV4PagePaginationArray as DatasetListResponsesV4PagePaginationArray,
    type DatasetCreateParams as DatasetCreateParams,
    type DatasetUpdateParams as DatasetUpdateParams,
    type DatasetListParams as DatasetListParams,
    type DatasetDeleteParams as DatasetDeleteParams,
    type DatasetGetParams as DatasetGetParams,
  };
}
