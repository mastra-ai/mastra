// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as DatasetsAPI from './datasets';
import {
  DatasetCreateParams,
  DatasetCreateResponse,
  DatasetDeleteParams,
  DatasetDeleteResponse,
  DatasetGetParams,
  DatasetGetResponse,
  DatasetListParams,
  DatasetListResponse,
  DatasetListResponsesV4PagePaginationArray,
  DatasetUpdateParams,
  DatasetUpdateResponse,
  Datasets,
} from './datasets';
import * as EvaluationTypesAPI from './evaluation-types';
import {
  EvaluationTypeListParams,
  EvaluationTypeListResponse,
  EvaluationTypeListResponsesV4PagePaginationArray,
  EvaluationTypes,
} from './evaluation-types';
import * as EvaluationsAPI from './evaluations';
import {
  EvaluationCreateParams,
  EvaluationCreateResponse,
  EvaluationDeleteParams,
  EvaluationDeleteResponse,
  EvaluationGetParams,
  EvaluationGetResponse,
  EvaluationListParams,
  EvaluationListResponse,
  EvaluationListResponsesV4PagePaginationArray,
  Evaluations,
} from './evaluations';
import * as LogsAPI from './logs';
import {
  LogDeleteParams,
  LogDeleteResponse,
  LogEditParams,
  LogEditResponse,
  LogGetParams,
  LogGetResponse,
  LogListParams,
  LogListResponse,
  LogListResponsesV4PagePaginationArray,
  LogRequestParams,
  LogRequestResponse,
  LogResponseParams,
  LogResponseResponse,
  Logs,
} from './logs';
import * as URLsAPI from './urls';
import { URLGetParams, URLGetResponse, URLs } from './urls';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../pagination';

export class AIGateway extends APIResource {
  evaluationTypes: EvaluationTypesAPI.EvaluationTypes = new EvaluationTypesAPI.EvaluationTypes(this._client);
  logs: LogsAPI.Logs = new LogsAPI.Logs(this._client);
  datasets: DatasetsAPI.Datasets = new DatasetsAPI.Datasets(this._client);
  evaluations: EvaluationsAPI.Evaluations = new EvaluationsAPI.Evaluations(this._client);
  urls: URLsAPI.URLs = new URLsAPI.URLs(this._client);

  /**
   * Create a new Gateway
   *
   * @example
   * ```ts
   * const aiGateway = await client.aiGateway.create({
   *   account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   *   id: 'my-gateway',
   *   cache_invalidate_on_update: true,
   *   cache_ttl: 0,
   *   collect_logs: true,
   *   rate_limiting_interval: 0,
   *   rate_limiting_limit: 0,
   *   rate_limiting_technique: 'fixed',
   * });
   * ```
   */
  create(
    params: AIGatewayCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AIGatewayCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/ai-gateway/gateways`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: AIGatewayCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Update a Gateway
   *
   * @example
   * ```ts
   * const aiGateway = await client.aiGateway.update(
   *   'my-gateway',
   *   {
   *     account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   *     cache_invalidate_on_update: true,
   *     cache_ttl: 0,
   *     collect_logs: true,
   *     rate_limiting_interval: 0,
   *     rate_limiting_limit: 0,
   *     rate_limiting_technique: 'fixed',
   *   },
   * );
   * ```
   */
  update(
    id: string,
    params: AIGatewayUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AIGatewayUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/ai-gateway/gateways/${id}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: AIGatewayUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List Gateways
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const aiGatewayListResponse of client.aiGateway.list(
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: AIGatewayListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<AIGatewayListResponsesV4PagePaginationArray, AIGatewayListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/ai-gateway/gateways`,
      AIGatewayListResponsesV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a Gateway
   *
   * @example
   * ```ts
   * const aiGateway = await client.aiGateway.delete(
   *   'my-gateway',
   *   { account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0' },
   * );
   * ```
   */
  delete(
    id: string,
    params: AIGatewayDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AIGatewayDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/ai-gateway/gateways/${id}`, options) as Core.APIPromise<{
        result: AIGatewayDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a Gateway
   *
   * @example
   * ```ts
   * const aiGateway = await client.aiGateway.get('my-gateway', {
   *   account_id: '3ebbcb006d4d46d7bb6a8c7f14676cb0',
   * });
   * ```
   */
  get(
    id: string,
    params: AIGatewayGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<AIGatewayGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${id}`, options) as Core.APIPromise<{
        result: AIGatewayGetResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class AIGatewayListResponsesV4PagePaginationArray extends V4PagePaginationArray<AIGatewayListResponse> {}

export interface AIGatewayCreateResponse {
  /**
   * gateway id
   */
  id: string;

  account_id: string;

  account_tag: string;

  cache_invalidate_on_update: boolean;

  cache_ttl: number | null;

  collect_logs: boolean;

  created_at: string;

  internal_id: string;

  modified_at: string;

  rate_limiting_interval: number | null;

  rate_limiting_limit: number | null;

  rate_limiting_technique: 'fixed' | 'sliding';

  authentication?: boolean;

  log_management?: number | null;

  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  logpush?: boolean;

  logpush_public_key?: string | null;
}

export interface AIGatewayUpdateResponse {
  /**
   * gateway id
   */
  id: string;

  account_id: string;

  account_tag: string;

  cache_invalidate_on_update: boolean;

  cache_ttl: number | null;

  collect_logs: boolean;

  created_at: string;

  internal_id: string;

  modified_at: string;

  rate_limiting_interval: number | null;

  rate_limiting_limit: number | null;

  rate_limiting_technique: 'fixed' | 'sliding';

  authentication?: boolean;

  log_management?: number | null;

  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  logpush?: boolean;

  logpush_public_key?: string | null;
}

export interface AIGatewayListResponse {
  /**
   * gateway id
   */
  id: string;

  account_id: string;

  account_tag: string;

  cache_invalidate_on_update: boolean;

  cache_ttl: number | null;

  collect_logs: boolean;

  created_at: string;

  internal_id: string;

  modified_at: string;

  rate_limiting_interval: number | null;

  rate_limiting_limit: number | null;

  rate_limiting_technique: 'fixed' | 'sliding';

  authentication?: boolean;

  log_management?: number | null;

  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  logpush?: boolean;

  logpush_public_key?: string | null;
}

export interface AIGatewayDeleteResponse {
  /**
   * gateway id
   */
  id: string;

  account_id: string;

  account_tag: string;

  cache_invalidate_on_update: boolean;

  cache_ttl: number | null;

  collect_logs: boolean;

  created_at: string;

  internal_id: string;

  modified_at: string;

  rate_limiting_interval: number | null;

  rate_limiting_limit: number | null;

  rate_limiting_technique: 'fixed' | 'sliding';

  authentication?: boolean;

  log_management?: number | null;

  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  logpush?: boolean;

  logpush_public_key?: string | null;
}

export interface AIGatewayGetResponse {
  /**
   * gateway id
   */
  id: string;

  account_id: string;

  account_tag: string;

  cache_invalidate_on_update: boolean;

  cache_ttl: number | null;

  collect_logs: boolean;

  created_at: string;

  internal_id: string;

  modified_at: string;

  rate_limiting_interval: number | null;

  rate_limiting_limit: number | null;

  rate_limiting_technique: 'fixed' | 'sliding';

  authentication?: boolean;

  log_management?: number | null;

  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  logpush?: boolean;

  logpush_public_key?: string | null;
}

export interface AIGatewayCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: gateway id
   */
  id: string;

  /**
   * Body param:
   */
  cache_invalidate_on_update: boolean;

  /**
   * Body param:
   */
  cache_ttl: number | null;

  /**
   * Body param:
   */
  collect_logs: boolean;

  /**
   * Body param:
   */
  rate_limiting_interval: number | null;

  /**
   * Body param:
   */
  rate_limiting_limit: number | null;

  /**
   * Body param:
   */
  rate_limiting_technique: 'fixed' | 'sliding';

  /**
   * Body param:
   */
  authentication?: boolean;

  /**
   * Body param:
   */
  log_management?: number | null;

  /**
   * Body param:
   */
  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  /**
   * Body param:
   */
  logpush?: boolean;

  /**
   * Body param:
   */
  logpush_public_key?: string | null;
}

export interface AIGatewayUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  cache_invalidate_on_update: boolean;

  /**
   * Body param:
   */
  cache_ttl: number | null;

  /**
   * Body param:
   */
  collect_logs: boolean;

  /**
   * Body param:
   */
  rate_limiting_interval: number | null;

  /**
   * Body param:
   */
  rate_limiting_limit: number | null;

  /**
   * Body param:
   */
  rate_limiting_technique: 'fixed' | 'sliding';

  /**
   * Body param:
   */
  authentication?: boolean;

  /**
   * Body param:
   */
  log_management?: number | null;

  /**
   * Body param:
   */
  log_management_strategy?: 'STOP_INSERTING' | 'DELETE_OLDEST' | null;

  /**
   * Body param:
   */
  logpush?: boolean;

  /**
   * Body param:
   */
  logpush_public_key?: string | null;
}

export interface AIGatewayListParams extends V4PagePaginationArrayParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Query param: Search by id
   */
  search?: string;
}

export interface AIGatewayDeleteParams {
  account_id: string;
}

export interface AIGatewayGetParams {
  account_id: string;
}

AIGateway.AIGatewayListResponsesV4PagePaginationArray = AIGatewayListResponsesV4PagePaginationArray;
AIGateway.EvaluationTypes = EvaluationTypes;
AIGateway.EvaluationTypeListResponsesV4PagePaginationArray = EvaluationTypeListResponsesV4PagePaginationArray;
AIGateway.Logs = Logs;
AIGateway.LogListResponsesV4PagePaginationArray = LogListResponsesV4PagePaginationArray;
AIGateway.Datasets = Datasets;
AIGateway.DatasetListResponsesV4PagePaginationArray = DatasetListResponsesV4PagePaginationArray;
AIGateway.Evaluations = Evaluations;
AIGateway.EvaluationListResponsesV4PagePaginationArray = EvaluationListResponsesV4PagePaginationArray;
AIGateway.URLs = URLs;

export declare namespace AIGateway {
  export {
    type AIGatewayCreateResponse as AIGatewayCreateResponse,
    type AIGatewayUpdateResponse as AIGatewayUpdateResponse,
    type AIGatewayListResponse as AIGatewayListResponse,
    type AIGatewayDeleteResponse as AIGatewayDeleteResponse,
    type AIGatewayGetResponse as AIGatewayGetResponse,
    AIGatewayListResponsesV4PagePaginationArray as AIGatewayListResponsesV4PagePaginationArray,
    type AIGatewayCreateParams as AIGatewayCreateParams,
    type AIGatewayUpdateParams as AIGatewayUpdateParams,
    type AIGatewayListParams as AIGatewayListParams,
    type AIGatewayDeleteParams as AIGatewayDeleteParams,
    type AIGatewayGetParams as AIGatewayGetParams,
  };

  export {
    EvaluationTypes as EvaluationTypes,
    type EvaluationTypeListResponse as EvaluationTypeListResponse,
    EvaluationTypeListResponsesV4PagePaginationArray as EvaluationTypeListResponsesV4PagePaginationArray,
    type EvaluationTypeListParams as EvaluationTypeListParams,
  };

  export {
    Logs as Logs,
    type LogListResponse as LogListResponse,
    type LogDeleteResponse as LogDeleteResponse,
    type LogEditResponse as LogEditResponse,
    type LogGetResponse as LogGetResponse,
    type LogRequestResponse as LogRequestResponse,
    type LogResponseResponse as LogResponseResponse,
    LogListResponsesV4PagePaginationArray as LogListResponsesV4PagePaginationArray,
    type LogListParams as LogListParams,
    type LogDeleteParams as LogDeleteParams,
    type LogEditParams as LogEditParams,
    type LogGetParams as LogGetParams,
    type LogRequestParams as LogRequestParams,
    type LogResponseParams as LogResponseParams,
  };

  export {
    Datasets as Datasets,
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

  export {
    Evaluations as Evaluations,
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

  export { URLs as URLs, type URLGetResponse as URLGetResponse, type URLGetParams as URLGetParams };
}
