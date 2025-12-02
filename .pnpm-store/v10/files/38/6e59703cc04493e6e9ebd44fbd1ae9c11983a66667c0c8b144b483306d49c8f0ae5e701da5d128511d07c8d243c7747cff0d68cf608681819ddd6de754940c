import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Datasets extends APIResource {
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
    create(gatewayId: string, params: DatasetCreateParams, options?: Core.RequestOptions): Core.APIPromise<DatasetCreateResponse>;
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
    update(gatewayId: string, id: string, params: DatasetUpdateParams, options?: Core.RequestOptions): Core.APIPromise<DatasetUpdateResponse>;
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
    list(gatewayId: string, params: DatasetListParams, options?: Core.RequestOptions): Core.PagePromise<DatasetListResponsesV4PagePaginationArray, DatasetListResponse>;
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
    delete(gatewayId: string, id: string, params: DatasetDeleteParams, options?: Core.RequestOptions): Core.APIPromise<DatasetDeleteResponse>;
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
    get(gatewayId: string, id: string, params: DatasetGetParams, options?: Core.RequestOptions): Core.APIPromise<DatasetGetResponse>;
}
export declare class DatasetListResponsesV4PagePaginationArray extends V4PagePaginationArray<DatasetListResponse> {
}
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
export declare namespace DatasetCreateResponse {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetUpdateResponse {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetListResponse {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetDeleteResponse {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetGetResponse {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetCreateParams {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace DatasetUpdateParams {
    interface Filter {
        key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
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
export declare namespace Datasets {
    export { type DatasetCreateResponse as DatasetCreateResponse, type DatasetUpdateResponse as DatasetUpdateResponse, type DatasetListResponse as DatasetListResponse, type DatasetDeleteResponse as DatasetDeleteResponse, type DatasetGetResponse as DatasetGetResponse, DatasetListResponsesV4PagePaginationArray as DatasetListResponsesV4PagePaginationArray, type DatasetCreateParams as DatasetCreateParams, type DatasetUpdateParams as DatasetUpdateParams, type DatasetListParams as DatasetListParams, type DatasetDeleteParams as DatasetDeleteParams, type DatasetGetParams as DatasetGetParams, };
}
//# sourceMappingURL=datasets.d.ts.map