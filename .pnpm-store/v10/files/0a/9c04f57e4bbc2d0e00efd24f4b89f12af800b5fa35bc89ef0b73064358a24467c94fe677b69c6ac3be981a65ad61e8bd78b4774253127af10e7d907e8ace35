import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SchemaAPI from "./schema.js";
import { Schema, SchemaGetParams, SchemaGetResponse } from "./schema.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Models extends APIResource {
    schema: SchemaAPI.Schema;
    /**
     * Model Search
     */
    list(params: ModelListParams, options?: Core.RequestOptions): Core.PagePromise<ModelListResponsesV4PagePaginationArray, ModelListResponse>;
}
export declare class ModelListResponsesV4PagePaginationArray extends V4PagePaginationArray<ModelListResponse> {
}
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
export declare namespace Models {
    export { type ModelListResponse as ModelListResponse, ModelListResponsesV4PagePaginationArray as ModelListResponsesV4PagePaginationArray, type ModelListParams as ModelListParams, };
    export { Schema as Schema, type SchemaGetResponse as SchemaGetResponse, type SchemaGetParams as SchemaGetParams, };
}
//# sourceMappingURL=models.d.ts.map