import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Evaluations extends APIResource {
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
    create(gatewayId: string, params: EvaluationCreateParams, options?: Core.RequestOptions): Core.APIPromise<EvaluationCreateResponse>;
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
    list(gatewayId: string, params: EvaluationListParams, options?: Core.RequestOptions): Core.PagePromise<EvaluationListResponsesV4PagePaginationArray, EvaluationListResponse>;
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
    delete(gatewayId: string, id: string, params: EvaluationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<EvaluationDeleteResponse>;
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
    get(gatewayId: string, id: string, params: EvaluationGetParams, options?: Core.RequestOptions): Core.APIPromise<EvaluationGetResponse>;
}
export declare class EvaluationListResponsesV4PagePaginationArray extends V4PagePaginationArray<EvaluationListResponse> {
}
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
export declare namespace EvaluationCreateResponse {
    interface Dataset {
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
    namespace Dataset {
        interface Filter {
            key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
            operator: 'eq' | 'contains' | 'lt' | 'gt';
            value: Array<string | number | boolean>;
        }
    }
    interface Result {
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
export declare namespace EvaluationListResponse {
    interface Dataset {
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
    namespace Dataset {
        interface Filter {
            key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
            operator: 'eq' | 'contains' | 'lt' | 'gt';
            value: Array<string | number | boolean>;
        }
    }
    interface Result {
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
export declare namespace EvaluationDeleteResponse {
    interface Dataset {
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
    namespace Dataset {
        interface Filter {
            key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
            operator: 'eq' | 'contains' | 'lt' | 'gt';
            value: Array<string | number | boolean>;
        }
    }
    interface Result {
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
export declare namespace EvaluationGetResponse {
    interface Dataset {
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
    namespace Dataset {
        interface Filter {
            key: 'created_at' | 'request_content_type' | 'response_content_type' | 'success' | 'cached' | 'provider' | 'model' | 'cost' | 'tokens' | 'tokens_in' | 'tokens_out' | 'duration' | 'feedback';
            operator: 'eq' | 'contains' | 'lt' | 'gt';
            value: Array<string | number | boolean>;
        }
    }
    interface Result {
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
export declare namespace Evaluations {
    export { type EvaluationCreateResponse as EvaluationCreateResponse, type EvaluationListResponse as EvaluationListResponse, type EvaluationDeleteResponse as EvaluationDeleteResponse, type EvaluationGetResponse as EvaluationGetResponse, EvaluationListResponsesV4PagePaginationArray as EvaluationListResponsesV4PagePaginationArray, type EvaluationCreateParams as EvaluationCreateParams, type EvaluationListParams as EvaluationListParams, type EvaluationDeleteParams as EvaluationDeleteParams, type EvaluationGetParams as EvaluationGetParams, };
}
//# sourceMappingURL=evaluations.d.ts.map