import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Versions extends APIResource {
    /**
     * List deployed Workflow versions
     */
    list(workflowName: string, params: VersionListParams, options?: Core.RequestOptions): Core.PagePromise<VersionListResponsesV4PagePaginationArray, VersionListResponse>;
    /**
     * Get Workflow version details
     */
    get(workflowName: string, versionId: string, params: VersionGetParams, options?: Core.RequestOptions): Core.APIPromise<VersionGetResponse>;
}
export declare class VersionListResponsesV4PagePaginationArray extends V4PagePaginationArray<VersionListResponse> {
}
export interface VersionListResponse {
    id: string;
    class_name: string;
    created_on: string;
    modified_on: string;
    workflow_id: string;
}
export interface VersionGetResponse {
    id: string;
    class_name: string;
    created_on: string;
    modified_on: string;
    workflow_id: string;
}
export interface VersionListParams extends V4PagePaginationArrayParams {
    /**
     * Path param:
     */
    account_id: string;
}
export interface VersionGetParams {
    account_id: string;
}
export declare namespace Versions {
    export { type VersionListResponse as VersionListResponse, type VersionGetResponse as VersionGetResponse, VersionListResponsesV4PagePaginationArray as VersionListResponsesV4PagePaginationArray, type VersionListParams as VersionListParams, type VersionGetParams as VersionGetParams, };
}
//# sourceMappingURL=versions.d.ts.map