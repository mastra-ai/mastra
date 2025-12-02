import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Hosts extends APIResource {
    /**
     * Retrieve schema hosts in a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    list(params: HostListParams, options?: Core.RequestOptions): Core.PagePromise<HostListResponsesV4PagePaginationArray, HostListResponse>;
}
export declare class HostListResponsesV4PagePaginationArray extends V4PagePaginationArray<HostListResponse> {
}
export interface HostListResponse {
    created_at: string;
    /**
     * Hosts serving the schema, e.g zone.host.com
     */
    hosts: Array<string>;
    /**
     * Name of the schema
     */
    name: string;
    /**
     * UUID.
     */
    schema_id: string;
}
export interface HostListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
}
export declare namespace Hosts {
    export { type HostListResponse as HostListResponse, HostListResponsesV4PagePaginationArray as HostListResponsesV4PagePaginationArray, type HostListParams as HostListParams, };
}
//# sourceMappingURL=hosts.d.ts.map