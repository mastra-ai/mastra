import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as VersionsAPI from "./versions.js";
import { VersionGetParams, VersionGetResponse, VersionListParams, VersionListResponse, VersionListResponsesV4PagePaginationArray, Versions } from "./versions.js";
import * as InstancesAPI from "./instances/instances.js";
import { InstanceBulkParams, InstanceBulkResponse, InstanceBulkResponsesSinglePage, InstanceCreateParams, InstanceCreateResponse, InstanceGetParams, InstanceGetResponse, InstanceListParams, InstanceListResponse, InstanceListResponsesV4PagePaginationArray, Instances as InstancesAPIInstances } from "./instances/instances.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Workflows extends APIResource {
    instances: InstancesAPI.Instances;
    versions: VersionsAPI.Versions;
    /**
     * Create/modify Workflow
     */
    update(workflowName: string, params: WorkflowUpdateParams, options?: Core.RequestOptions): Core.APIPromise<WorkflowUpdateResponse>;
    /**
     * List all Workflows
     */
    list(params: WorkflowListParams, options?: Core.RequestOptions): Core.PagePromise<WorkflowListResponsesV4PagePaginationArray, WorkflowListResponse>;
    /**
     * Deletes a Workflow. This only deletes the Workflow and does not delete or modify
     * any Worker associated to this Workflow or bounded to it.
     */
    delete(workflowName: string, params: WorkflowDeleteParams, options?: Core.RequestOptions): Core.APIPromise<WorkflowDeleteResponse>;
    /**
     * Get Workflow details
     */
    get(workflowName: string, params: WorkflowGetParams, options?: Core.RequestOptions): Core.APIPromise<WorkflowGetResponse>;
}
export declare class WorkflowListResponsesV4PagePaginationArray extends V4PagePaginationArray<WorkflowListResponse> {
}
export interface WorkflowUpdateResponse {
    id: string;
    class_name: string;
    created_on: string;
    is_deleted: number;
    modified_on: string;
    name: string;
    script_name: string;
    terminator_running: number;
    triggered_on: string | null;
    version_id: string;
}
export interface WorkflowListResponse {
    id: string;
    class_name: string;
    created_on: string;
    instances: WorkflowListResponse.Instances;
    modified_on: string;
    name: string;
    script_name: string;
    triggered_on: string | null;
}
export declare namespace WorkflowListResponse {
    interface Instances {
        complete?: number;
        errored?: number;
        paused?: number;
        queued?: number;
        running?: number;
        terminated?: number;
        waiting?: number;
        waitingForPause?: number;
    }
}
export interface WorkflowDeleteResponse {
    status: 'ok';
    success: boolean | null;
}
export interface WorkflowGetResponse {
    id: string;
    class_name: string;
    created_on: string;
    instances: WorkflowGetResponse.Instances;
    modified_on: string;
    name: string;
    script_name: string;
    triggered_on: string | null;
}
export declare namespace WorkflowGetResponse {
    interface Instances {
        complete?: number;
        errored?: number;
        paused?: number;
        queued?: number;
        running?: number;
        terminated?: number;
        waiting?: number;
        waitingForPause?: number;
    }
}
export interface WorkflowUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    class_name: string;
    /**
     * Body param:
     */
    script_name: string;
}
export interface WorkflowListParams extends V4PagePaginationArrayParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: Allows filtering workflows` name.
     */
    search?: string;
}
export interface WorkflowDeleteParams {
    account_id: string;
}
export interface WorkflowGetParams {
    account_id: string;
}
export declare namespace Workflows {
    export { type WorkflowUpdateResponse as WorkflowUpdateResponse, type WorkflowListResponse as WorkflowListResponse, type WorkflowDeleteResponse as WorkflowDeleteResponse, type WorkflowGetResponse as WorkflowGetResponse, WorkflowListResponsesV4PagePaginationArray as WorkflowListResponsesV4PagePaginationArray, type WorkflowUpdateParams as WorkflowUpdateParams, type WorkflowListParams as WorkflowListParams, type WorkflowDeleteParams as WorkflowDeleteParams, type WorkflowGetParams as WorkflowGetParams, };
    export { InstancesAPIInstances as Instances, type InstanceCreateResponse as InstanceCreateResponse, type InstanceListResponse as InstanceListResponse, type InstanceBulkResponse as InstanceBulkResponse, type InstanceGetResponse as InstanceGetResponse, InstanceListResponsesV4PagePaginationArray as InstanceListResponsesV4PagePaginationArray, InstanceBulkResponsesSinglePage as InstanceBulkResponsesSinglePage, type InstanceCreateParams as InstanceCreateParams, type InstanceListParams as InstanceListParams, type InstanceBulkParams as InstanceBulkParams, type InstanceGetParams as InstanceGetParams, };
    export { Versions as Versions, type VersionListResponse as VersionListResponse, type VersionGetResponse as VersionGetResponse, VersionListResponsesV4PagePaginationArray as VersionListResponsesV4PagePaginationArray, type VersionListParams as VersionListParams, type VersionGetParams as VersionGetParams, };
}
//# sourceMappingURL=workflows.d.ts.map