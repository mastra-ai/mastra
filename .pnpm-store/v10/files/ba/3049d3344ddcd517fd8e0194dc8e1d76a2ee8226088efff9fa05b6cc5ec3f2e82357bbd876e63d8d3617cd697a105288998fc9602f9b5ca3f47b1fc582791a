// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class Evaluations extends APIResource {
  /**
   * Create a new Evaluation
   *
   * @example
   * ```ts
   * const evaluation =
   *   await client.aiGateway.evaluations.create('my-gateway', {
   *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   *     dataset_ids: ['string'],
   *     evaluation_type_ids: ['string'],
   *     name: 'name',
   *   });
   * ```
   */
  create(
    gatewayId: string,
    params: EvaluationCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EvaluationCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: EvaluationCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Evaluations
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const evaluationListResponse of client.aiGateway.evaluations.list(
   *   'my-gateway',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    gatewayId: string,
    params: EvaluationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<EvaluationListResponsesV4PagePaginationArray, EvaluationListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations`,
      EvaluationListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a Evaluation
   *
   * @example
   * ```ts
   * const evaluation =
   *   await client.aiGateway.evaluations.delete(
   *     'my-gateway',
   *     'id',
   *     { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   *   );
   * ```
   */
  delete(
    gatewayId: string,
    id: string,
    params: EvaluationDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EvaluationDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations/${id}`,
        options,
      ) as Core.APIPromise<{ result: EvaluationDeleteResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a Evaluation
   *
   * @example
   * ```ts
   * const evaluation = await client.aiGateway.evaluations.get(
   *   'my-gateway',
   *   'id',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * );
   * ```
   */
  get(
    gatewayId: string,
    id: string,
    params: EvaluationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<EvaluationGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/evaluations/${id}`,
        options,
      ) as Core.APIPromise<{ result: EvaluationGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class EvaluationListResponsesV4PagePaginationArray extends V4PagePaginationArray<EvaluationListResponse> {}

export interface EvaluationCreateResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  datasets: Array<EvaluationCreateResponse.Dataset>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;

  processed: boolean;

  results: Array<EvaluationCreateResponse.Result>;

  total_logs: number;
}

export namespace EvaluationCreateResponse {
  export interface Dataset {
    id: string;

    account_id: string;

    account_tag: string;

    created_at: string;

    enable: boolean;

    filters: Array<Dataset.Filter>;

    /**
     * gateway id
     */
    gateway_id: string;

    modified_at: string;

    name: string;
  }

  export namespace Dataset {
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

  export interface Result {
    id: string;

    created_at: string;

    evaluation_id: string;

    evaluation_type_id: string;

    modified_at: string;

    result: string;

    status: number;

    status_description: string;

    total_logs: number;
  }
}

export interface EvaluationListResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  datasets: Array<EvaluationListResponse.Dataset>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;

  processed: boolean;

  results: Array<EvaluationListResponse.Result>;

  total_logs: number;
}

export namespace EvaluationListResponse {
  export interface Dataset {
    id: string;

    account_id: string;

    account_tag: string;

    created_at: string;

    enable: boolean;

    filters: Array<Dataset.Filter>;

    /**
     * gateway id
     */
    gateway_id: string;

    modified_at: string;

    name: string;
  }

  export namespace Dataset {
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

  export interface Result {
    id: string;

    created_at: string;

    evaluation_id: string;

    evaluation_type_id: string;

    modified_at: string;

    result: string;

    status: number;

    status_description: string;

    total_logs: number;
  }
}

export interface EvaluationDeleteResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  datasets: Array<EvaluationDeleteResponse.Dataset>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;

  processed: boolean;

  results: Array<EvaluationDeleteResponse.Result>;

  total_logs: number;
}

export namespace EvaluationDeleteResponse {
  export interface Dataset {
    id: string;

    account_id: string;

    account_tag: string;

    created_at: string;

    enable: boolean;

    filters: Array<Dataset.Filter>;

    /**
     * gateway id
     */
    gateway_id: string;

    modified_at: string;

    name: string;
  }

  export namespace Dataset {
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

  export interface Result {
    id: string;

    created_at: string;

    evaluation_id: string;

    evaluation_type_id: string;

    modified_at: string;

    result: string;

    status: number;

    status_description: string;

    total_logs: number;
  }
}

export interface EvaluationGetResponse {
  id: string;

  account_id: string;

  account_tag: string;

  created_at: string;

  datasets: Array<EvaluationGetResponse.Dataset>;

  /**
   * gateway id
   */
  gateway_id: string;

  modified_at: string;

  name: string;

  processed: boolean;

  results: Array<EvaluationGetResponse.Result>;

  total_logs: number;
}

export namespace EvaluationGetResponse {
  export interface Dataset {
    id: string;

    account_id: string;

    account_tag: string;

    created_at: string;

    enable: boolean;

    filters: Array<Dataset.Filter>;

    /**
     * gateway id
     */
    gateway_id: string;

    modified_at: string;

    name: string;
  }

  export namespace Dataset {
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

  export interface Result {
    id: string;

    created_at: string;

    evaluation_id: string;

    evaluation_type_id: string;

    modified_at: string;

    result: string;

    status: number;

    status_description: string;

    total_logs: number;
  }
}

export interface EvaluationCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  dataset_ids: Array<string>;

  /**
   * Body param:
   */
  evaluation_type_ids: Array<string>;

  /**
   * Body param:
   */
  name: string;
}

export interface EvaluationListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  name?: string;

  /**
   * Query param:
   */
  processed?: boolean;

  /**
   * Query param: Search by id, name
   */
  search?: string;
}

export interface EvaluationDeleteParams {
  account_id: string;
}

export interface EvaluationGetParams {
  account_id: string;
}

Evaluations.EvaluationListResponsesV4PagePaginationArray = EvaluationListResponsesV4PagePaginationArray;

export declare namespace Evaluations {
  export {
    type EvaluationCreateResponse as EvaluationCreateResponse,
    type EvaluationListResponse as EvaluationListResponse,
    type EvaluationDeleteResponse as EvaluationDeleteResponse,
    type EvaluationGetResponse as EvaluationGetResponse,
    EvaluationListResponsesV4PagePaginationArray as EvaluationListResponsesV4PagePaginationArray,
    type EvaluationCreateParams as EvaluationCreateParams,
    type EvaluationListParams as EvaluationListParams,
    type EvaluationDeleteParams as EvaluationDeleteParams,
    type EvaluationGetParams as EvaluationGetParams,
  };
}
