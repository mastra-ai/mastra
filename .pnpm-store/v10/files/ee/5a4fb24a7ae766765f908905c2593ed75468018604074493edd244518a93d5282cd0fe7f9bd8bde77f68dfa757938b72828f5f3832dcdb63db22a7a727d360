import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as DatasetsAPI from "./datasets.js";
import { DatasetCreateParams, DatasetCreateResponse, DatasetDeleteParams, DatasetDeleteResponse, DatasetGetParams, DatasetGetResponse, DatasetListParams, DatasetListResponse, DatasetListResponsesV4PagePaginationArray, DatasetUpdateParams, DatasetUpdateResponse, Datasets } from "./datasets.js";
import * as EvaluationTypesAPI from "./evaluation-types.js";
import { EvaluationTypeListParams, EvaluationTypeListResponse, EvaluationTypeListResponsesV4PagePaginationArray, EvaluationTypes } from "./evaluation-types.js";
import * as EvaluationsAPI from "./evaluations.js";
import { EvaluationCreateParams, EvaluationCreateResponse, EvaluationDeleteParams, EvaluationDeleteResponse, EvaluationGetParams, EvaluationGetResponse, EvaluationListParams, EvaluationListResponse, EvaluationListResponsesV4PagePaginationArray, Evaluations } from "./evaluations.js";
import * as LogsAPI from "./logs.js";
import { LogDeleteParams, LogDeleteResponse, LogEditParams, LogEditResponse, LogGetParams, LogGetResponse, LogListParams, LogListResponse, LogListResponsesV4PagePaginationArray, LogRequestParams, LogRequestResponse, LogResponseParams, LogResponseResponse, Logs } from "./logs.js";
import * as URLsAPI from "./urls.js";
import { URLGetParams, URLGetResponse, URLs } from "./urls.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class AIGateway extends APIResource {
    evaluationTypes: EvaluationTypesAPI.EvaluationTypes;
    logs: LogsAPI.Logs;
    datasets: DatasetsAPI.Datasets;
    evaluations: EvaluationsAPI.Evaluations;
    urls: URLsAPI.URLs;
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
    create(params: AIGatewayCreateParams, options?: Core.RequestOptions): Core.APIPromise<AIGatewayCreateResponse>;
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
    update(id: string, params: AIGatewayUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AIGatewayUpdateResponse>;
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
    list(params: AIGatewayListParams, options?: Core.RequestOptions): Core.PagePromise<AIGatewayListResponsesV4PagePaginationArray, AIGatewayListResponse>;
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
    delete(id: string, params: AIGatewayDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AIGatewayDeleteResponse>;
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
    get(id: string, params: AIGatewayGetParams, options?: Core.RequestOptions): Core.APIPromise<AIGatewayGetResponse>;
}
export declare class AIGatewayListResponsesV4PagePaginationArray extends V4PagePaginationArray<AIGatewayListResponse> {
}
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
export declare namespace AIGateway {
    export { type AIGatewayCreateResponse as AIGatewayCreateResponse, type AIGatewayUpdateResponse as AIGatewayUpdateResponse, type AIGatewayListResponse as AIGatewayListResponse, type AIGatewayDeleteResponse as AIGatewayDeleteResponse, type AIGatewayGetResponse as AIGatewayGetResponse, AIGatewayListResponsesV4PagePaginationArray as AIGatewayListResponsesV4PagePaginationArray, type AIGatewayCreateParams as AIGatewayCreateParams, type AIGatewayUpdateParams as AIGatewayUpdateParams, type AIGatewayListParams as AIGatewayListParams, type AIGatewayDeleteParams as AIGatewayDeleteParams, type AIGatewayGetParams as AIGatewayGetParams, };
    export { EvaluationTypes as EvaluationTypes, type EvaluationTypeListResponse as EvaluationTypeListResponse, EvaluationTypeListResponsesV4PagePaginationArray as EvaluationTypeListResponsesV4PagePaginationArray, type EvaluationTypeListParams as EvaluationTypeListParams, };
    export { Logs as Logs, type LogListResponse as LogListResponse, type LogDeleteResponse as LogDeleteResponse, type LogEditResponse as LogEditResponse, type LogGetResponse as LogGetResponse, type LogRequestResponse as LogRequestResponse, type LogResponseResponse as LogResponseResponse, LogListResponsesV4PagePaginationArray as LogListResponsesV4PagePaginationArray, type LogListParams as LogListParams, type LogDeleteParams as LogDeleteParams, type LogEditParams as LogEditParams, type LogGetParams as LogGetParams, type LogRequestParams as LogRequestParams, type LogResponseParams as LogResponseParams, };
    export { Datasets as Datasets, type DatasetCreateResponse as DatasetCreateResponse, type DatasetUpdateResponse as DatasetUpdateResponse, type DatasetListResponse as DatasetListResponse, type DatasetDeleteResponse as DatasetDeleteResponse, type DatasetGetResponse as DatasetGetResponse, DatasetListResponsesV4PagePaginationArray as DatasetListResponsesV4PagePaginationArray, type DatasetCreateParams as DatasetCreateParams, type DatasetUpdateParams as DatasetUpdateParams, type DatasetListParams as DatasetListParams, type DatasetDeleteParams as DatasetDeleteParams, type DatasetGetParams as DatasetGetParams, };
    export { Evaluations as Evaluations, type EvaluationCreateResponse as EvaluationCreateResponse, type EvaluationListResponse as EvaluationListResponse, type EvaluationDeleteResponse as EvaluationDeleteResponse, type EvaluationGetResponse as EvaluationGetResponse, EvaluationListResponsesV4PagePaginationArray as EvaluationListResponsesV4PagePaginationArray, type EvaluationCreateParams as EvaluationCreateParams, type EvaluationListParams as EvaluationListParams, type EvaluationDeleteParams as EvaluationDeleteParams, type EvaluationGetParams as EvaluationGetParams, };
    export { URLs as URLs, type URLGetResponse as URLGetResponse, type URLGetParams as URLGetParams };
}
//# sourceMappingURL=ai-gateway.d.ts.map