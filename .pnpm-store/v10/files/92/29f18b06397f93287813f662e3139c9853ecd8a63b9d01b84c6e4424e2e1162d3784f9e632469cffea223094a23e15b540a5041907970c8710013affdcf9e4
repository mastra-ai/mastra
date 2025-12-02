import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Fields extends APIResource {
    /**
     * Lists all fields available. The response is json object with key-value pairs,
     * where keys are field names, and values are descriptions.
     *
     * @example
     * ```ts
     * const field = await client.logs.received.fields.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: FieldGetParams, options?: Core.RequestOptions): Core.APIPromise<FieldGetResponse>;
}
export interface FieldGetResponse {
    key?: string;
}
export interface FieldGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace Fields {
    export { type FieldGetResponse as FieldGetResponse, type FieldGetParams as FieldGetParams };
}
//# sourceMappingURL=fields.d.ts.map