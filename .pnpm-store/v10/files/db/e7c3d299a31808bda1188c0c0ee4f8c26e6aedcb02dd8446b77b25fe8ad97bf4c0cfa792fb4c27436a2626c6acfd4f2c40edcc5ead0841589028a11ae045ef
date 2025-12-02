import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Schemas extends APIResource {
    /**
     * Retrieve operations and features as OpenAPI schemas
     *
     * @example
     * ```ts
     * const schemas = await client.apiGateway.schemas.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params: SchemaListParams, options?: Core.RequestOptions): Core.APIPromise<SchemaListResponse>;
}
export interface SchemaListResponse {
    schemas?: Array<unknown>;
    timestamp?: string;
}
export interface SchemaListParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Add feature(s) to the results. The feature name that is given here
     * corresponds to the resulting feature object. Have a look at the top-level object
     * description for more details on the specific meaning.
     */
    feature?: Array<'thresholds' | 'parameter_schemas' | 'schema_info'>;
    /**
     * Query param: Receive schema only for the given host(s).
     */
    host?: Array<string>;
}
export declare namespace Schemas {
    export { type SchemaListResponse as SchemaListResponse, type SchemaListParams as SchemaListParams };
}
//# sourceMappingURL=schemas.d.ts.map