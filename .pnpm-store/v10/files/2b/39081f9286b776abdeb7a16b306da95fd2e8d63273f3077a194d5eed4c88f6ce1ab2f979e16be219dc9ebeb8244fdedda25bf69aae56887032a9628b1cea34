// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class EvaluationTypes extends APIResource {
  /**
   * List Evaluators
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const evaluationTypeListResponse of client.aiGateway.evaluationTypes.list(
   *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: EvaluationTypeListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<EvaluationTypeListResponsesV4PagePaginationArray, EvaluationTypeListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai-gateway/evaluation-types`,
      EvaluationTypeListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }
}

export class EvaluationTypeListResponsesV4PagePaginationArray extends V4PagePaginationArray<EvaluationTypeListResponse> {}

export interface EvaluationTypeListResponse {
  id: string;

  created_at: string;

  description: string;

  enable: boolean;

  mandatory: boolean;

  modified_at: string;

  name: string;

  type: string;
}

export interface EvaluationTypeListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param:
   */
  order_by?: string;

  /**
   * Query param:
   */
  order_by_direction?: 'asc' | 'desc';
}

EvaluationTypes.EvaluationTypeListResponsesV4PagePaginationArray =
  EvaluationTypeListResponsesV4PagePaginationArray;

export declare namespace EvaluationTypes {
  export {
    type EvaluationTypeListResponse as EvaluationTypeListResponse,
    EvaluationTypeListResponsesV4PagePaginationArray as EvaluationTypeListResponsesV4PagePaginationArray,
    type EvaluationTypeListParams as EvaluationTypeListParams,
  };
}
