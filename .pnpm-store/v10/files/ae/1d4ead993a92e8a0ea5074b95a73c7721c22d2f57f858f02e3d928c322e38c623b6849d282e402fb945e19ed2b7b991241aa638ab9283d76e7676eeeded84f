import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Logs extends APIResource {
    /**
     * List Gateway Logs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logListResponse of client.aiGateway.logs.list(
     *   'my-gateway',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(gatewayId: string, params: LogListParams, options?: Core.RequestOptions): Core.PagePromise<LogListResponsesV4PagePaginationArray, LogListResponse>;
    /**
     * Delete Gateway Logs
     *
     * @example
     * ```ts
     * const log = await client.aiGateway.logs.delete(
     *   'my-gateway',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    delete(gatewayId: string, params: LogDeleteParams, options?: Core.RequestOptions): Core.APIPromise<LogDeleteResponse>;
    /**
     * Patch Gateway Log
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.edit(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    edit(gatewayId: string, id: string, params: LogEditParams, options?: Core.RequestOptions): Core.APIPromise<LogEditResponse>;
    /**
     * Get Gateway Log Detail
     *
     * @example
     * ```ts
     * const log = await client.aiGateway.logs.get(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    get(gatewayId: string, id: string, params: LogGetParams, options?: Core.RequestOptions): Core.APIPromise<LogGetResponse>;
    /**
     * Get Gateway Log Request
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.request(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    request(gatewayId: string, id: string, params: LogRequestParams, options?: Core.RequestOptions): Core.APIPromise<unknown>;
    /**
     * Get Gateway Log Response
     *
     * @example
     * ```ts
     * const response = await client.aiGateway.logs.response(
     *   'my-gateway',
     *   'id',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    response(gatewayId: string, id: string, params: LogResponseParams, options?: Core.RequestOptions): Core.APIPromise<unknown>;
}
export declare class LogListResponsesV4PagePaginationArray extends V4PagePaginationArray<LogListResponse> {
}
export interface LogListResponse {
    id: string;
    cached: boolean;
    created_at: string;
    duration: number;
    model: string;
    path: string;
    provider: string;
    success: boolean;
    tokens_in: number | null;
    tokens_out: number | null;
    cost?: number;
    custom_cost?: boolean;
    metadata?: string;
    model_type?: string;
    request_content_type?: string;
    request_type?: string;
    response_content_type?: string;
    status_code?: number;
    step?: number;
}
export interface LogDeleteResponse {
    success: boolean;
}
export type LogEditResponse = unknown;
export interface LogGetResponse {
    id: string;
    cached: boolean;
    created_at: string;
    duration: number;
    model: string;
    path: string;
    provider: string;
    success: boolean;
    tokens_in: number | null;
    tokens_out: number | null;
    cost?: number;
    custom_cost?: boolean;
    metadata?: string;
    model_type?: string;
    request_content_type?: string;
    request_head?: string;
    request_head_complete?: boolean;
    request_size?: number;
    request_type?: string;
    response_content_type?: string;
    response_head?: string;
    response_head_complete?: boolean;
    response_size?: number;
    status_code?: number;
    step?: number;
}
export type LogRequestResponse = unknown;
export type LogResponseResponse = unknown;
export interface LogListParams extends V4PagePaginationArrayParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * @deprecated Query param:
     */
    cached?: boolean;
    /**
     * @deprecated Query param:
     */
    direction?: 'asc' | 'desc';
    /**
     * @deprecated Query param:
     */
    end_date?: string;
    /**
     * @deprecated Query param:
     */
    feedback?: 0 | 1;
    /**
     * Query param:
     */
    filters?: Array<LogListParams.Filter>;
    /**
     * @deprecated Query param:
     */
    max_cost?: number;
    /**
     * @deprecated Query param:
     */
    max_duration?: number;
    /**
     * @deprecated Query param:
     */
    max_tokens_in?: number;
    /**
     * @deprecated Query param:
     */
    max_tokens_out?: number;
    /**
     * @deprecated Query param:
     */
    max_total_tokens?: number;
    /**
     * Query param:
     */
    meta_info?: boolean;
    /**
     * @deprecated Query param:
     */
    min_cost?: number;
    /**
     * @deprecated Query param:
     */
    min_duration?: number;
    /**
     * @deprecated Query param:
     */
    min_tokens_in?: number;
    /**
     * @deprecated Query param:
     */
    min_tokens_out?: number;
    /**
     * @deprecated Query param:
     */
    min_total_tokens?: number;
    /**
     * @deprecated Query param:
     */
    model?: string;
    /**
     * @deprecated Query param:
     */
    model_type?: string;
    /**
     * Query param:
     */
    order_by?: 'created_at' | 'provider' | 'model' | 'model_type' | 'success' | 'cached';
    /**
     * Query param:
     */
    order_by_direction?: 'asc' | 'desc';
    /**
     * @deprecated Query param:
     */
    provider?: string;
    /**
     * @deprecated Query param:
     */
    request_content_type?: string;
    /**
     * @deprecated Query param:
     */
    response_content_type?: string;
    /**
     * Query param:
     */
    search?: string;
    /**
     * @deprecated Query param:
     */
    start_date?: string;
    /**
     * @deprecated Query param:
     */
    success?: boolean;
}
export declare namespace LogListParams {
    interface Filter {
        key: 'id' | 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'model_type' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback' | 'event_id' | 'request_type' | 'metadata.key' | 'metadata.value' | 'prompts.prompt_id' | 'prompts.version_id';
        operator: 'eq' | 'neq' | 'contains' | 'lt' | 'gt';
        value: Array<string | null | number | boolean>;
    }
}
export interface LogDeleteParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param:
     */
    filters?: Array<LogDeleteParams.Filter>;
    /**
     * Query param:
     */
    limit?: number;
    /**
     * Query param:
     */
    order_by?: 'created_at' | 'provider' | 'model' | 'model_type' | 'success' | 'cached' | 'cost' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
    /**
     * Query param:
     */
    order_by_direction?: 'asc' | 'desc';
}
export declare namespace LogDeleteParams {
    interface Filter {
        key: 'id' | 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'model_type' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback' | 'event_id' | 'request_type' | 'metadata.key' | 'metadata.value' | 'prompts.prompt_id' | 'prompts.version_id';
        operator: 'eq' | 'neq' | 'contains' | 'lt' | 'gt';
        value: Array<string | null | number | boolean>;
    }
}
export interface LogEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    feedback?: number | null;
    /**
     * Body param:
     */
    metadata?: {
        [key: string]: string | number | boolean;
    } | null;
    /**
     * Body param:
     */
    score?: number | null;
}
export interface LogGetParams {
    account_id: string;
}
export interface LogRequestParams {
    account_id: string;
}
export interface LogResponseParams {
    account_id: string;
}
export declare namespace Logs {
    export { type LogListResponse as LogListResponse, type LogDeleteResponse as LogDeleteResponse, type LogEditResponse as LogEditResponse, type LogGetResponse as LogGetResponse, type LogRequestResponse as LogRequestResponse, type LogResponseResponse as LogResponseResponse, LogListResponsesV4PagePaginationArray as LogListResponsesV4PagePaginationArray, type LogListParams as LogListParams, type LogDeleteParams as LogDeleteParams, type LogEditParams as LogEditParams, type LogGetParams as LogGetParams, type LogRequestParams as LogRequestParams, type LogResponseParams as LogResponseParams, };
}
//# sourceMappingURL=logs.d.ts.map