import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class EvaluationTypes extends APIResource {
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
    list(params: EvaluationTypeListParams, options?: Core.RequestOptions): Core.PagePromise<EvaluationTypeListResponsesV4PagePaginationArray, EvaluationTypeListResponse>;
}
export declare class EvaluationTypeListResponsesV4PagePaginationArray extends V4PagePaginationArray<EvaluationTypeListResponse> {
}
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
export declare namespace EvaluationTypes {
    export { type EvaluationTypeListResponse as EvaluationTypeListResponse, EvaluationTypeListResponsesV4PagePaginationArray as EvaluationTypeListResponsesV4PagePaginationArray, type EvaluationTypeListParams as EvaluationTypeListParams, };
}
//# sourceMappingURL=evaluation-types.d.ts.map