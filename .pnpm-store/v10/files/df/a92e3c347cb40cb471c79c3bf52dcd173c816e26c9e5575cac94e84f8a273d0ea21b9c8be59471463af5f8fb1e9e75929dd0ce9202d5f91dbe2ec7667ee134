import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class SmartRouting extends APIResource {
    /**
     * Updates enablement of Argo Smart Routing.
     *
     * @example
     * ```ts
     * const response = await client.argo.smartRouting.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   value: 'on',
     * });
     * ```
     */
    edit(params: SmartRoutingEditParams, options?: Core.RequestOptions): Core.APIPromise<SmartRoutingEditResponse>;
    /**
     * Get Argo Smart Routing setting
     *
     * @example
     * ```ts
     * const smartRouting = await client.argo.smartRouting.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: SmartRoutingGetParams, options?: Core.RequestOptions): Core.APIPromise<SmartRoutingGetResponse>;
}
export type SmartRoutingEditResponse = unknown | string | null;
export type SmartRoutingGetResponse = unknown | string | null;
export interface SmartRoutingEditParams {
    /**
     * Path param: Identifier
     */
    zone_id: string;
    /**
     * Body param: Enables Argo Smart Routing.
     */
    value: 'on' | 'off';
}
export interface SmartRoutingGetParams {
    /**
     * Identifier
     */
    zone_id: string;
}
export declare namespace SmartRouting {
    export { type SmartRoutingEditResponse as SmartRoutingEditResponse, type SmartRoutingGetResponse as SmartRoutingGetResponse, type SmartRoutingEditParams as SmartRoutingEditParams, type SmartRoutingGetParams as SmartRoutingGetParams, };
}
//# sourceMappingURL=smart-routing.d.ts.map