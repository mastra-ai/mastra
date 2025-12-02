import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { CursorLimitPagination, type CursorLimitPaginationParams } from "../../../pagination.js";
export declare class Objects extends APIResource {
    /**
     * Returns the Durable Objects in a given namespace.
     */
    list(id: string, params: ObjectListParams, options?: Core.RequestOptions): Core.PagePromise<DurableObjectsCursorLimitPagination, DurableObject>;
}
export declare class DurableObjectsCursorLimitPagination extends CursorLimitPagination<DurableObject> {
}
export interface DurableObject {
    /**
     * ID of the Durable Object.
     */
    id?: string;
    /**
     * Whether the Durable Object has stored data.
     */
    hasStoredData?: boolean;
}
export interface ObjectListParams extends CursorLimitPaginationParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
}
export declare namespace Objects {
    export { type DurableObject as DurableObject, DurableObjectsCursorLimitPagination as DurableObjectsCursorLimitPagination, type ObjectListParams as ObjectListParams, };
}
//# sourceMappingURL=objects.d.ts.map