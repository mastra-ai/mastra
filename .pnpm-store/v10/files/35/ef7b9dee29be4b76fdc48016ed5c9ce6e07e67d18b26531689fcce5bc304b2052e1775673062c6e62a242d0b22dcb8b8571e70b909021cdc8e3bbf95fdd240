import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as EventsAPI from "./events.js";
import { EventCreateParams, EventCreateResponse, Events } from "./events.js";
import * as StatusAPI from "./status.js";
import { Status, StatusEditParams, StatusEditResponse } from "./status.js";
import { SinglePage, V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class Instances extends APIResource {
    status: StatusAPI.Status;
    events: EventsAPI.Events;
    /**
     * Create a new workflow instance
     */
    create(workflowName: string, params: InstanceCreateParams, options?: Core.RequestOptions): Core.APIPromise<InstanceCreateResponse>;
    /**
     * List of workflow instances
     */
    list(workflowName: string, params: InstanceListParams, options?: Core.RequestOptions): Core.PagePromise<InstanceListResponsesV4PagePaginationArray, InstanceListResponse>;
    /**
     * Batch create new Workflow instances
     */
    bulk(workflowName: string, params: InstanceBulkParams, options?: Core.RequestOptions): Core.PagePromise<InstanceBulkResponsesSinglePage, InstanceBulkResponse>;
    /**
     * Get logs and status from instance
     */
    get(workflowName: string, instanceId: string, params: InstanceGetParams, options?: Core.RequestOptions): Core.APIPromise<InstanceGetResponse>;
}
export declare class InstanceListResponsesV4PagePaginationArray extends V4PagePaginationArray<InstanceListResponse> {
}
export declare class InstanceBulkResponsesSinglePage extends SinglePage<InstanceBulkResponse> {
}
export interface InstanceCreateResponse {
    id: string;
    status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
    version_id: string;
    workflow_id: string;
}
export interface InstanceListResponse {
    id: string;
    created_on: string;
    ended_on: string | null;
    modified_on: string;
    started_on: string | null;
    status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
    version_id: string;
    workflow_id: string;
}
export interface InstanceBulkResponse {
    id: string;
    status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
    version_id: string;
    workflow_id: string;
}
export interface InstanceGetResponse {
    end: string | null;
    error: InstanceGetResponse.Error | null;
    output: string | number;
    params: unknown;
    queued: string;
    start: string | null;
    status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
    steps: Array<InstanceGetResponse.UnionMember0 | InstanceGetResponse.UnionMember1 | InstanceGetResponse.UnionMember2 | InstanceGetResponse.UnionMember3>;
    success: boolean | null;
    trigger: InstanceGetResponse.Trigger;
    versionId: string;
}
export declare namespace InstanceGetResponse {
    interface Error {
        message: string;
        name: string;
    }
    interface UnionMember0 {
        attempts: Array<UnionMember0.Attempt>;
        config: UnionMember0.Config;
        end: string | null;
        name: string;
        output: unknown;
        start: string;
        success: boolean | null;
        type: 'step';
    }
    namespace UnionMember0 {
        interface Attempt {
            end: string | null;
            error: Attempt.Error | null;
            start: string;
            success: boolean | null;
        }
        namespace Attempt {
            interface Error {
                message: string;
                name: string;
            }
        }
        interface Config {
            retries: Config.Retries;
            timeout: unknown | number;
        }
        namespace Config {
            interface Retries {
                delay: unknown | number;
                limit: number;
                backoff?: 'constant' | 'linear' | 'exponential';
            }
        }
    }
    interface UnionMember1 {
        end: string;
        error: UnionMember1.Error | null;
        finished: boolean;
        name: string;
        start: string;
        type: 'sleep';
    }
    namespace UnionMember1 {
        interface Error {
            message: string;
            name: string;
        }
    }
    interface UnionMember2 {
        trigger: UnionMember2.Trigger;
        type: 'termination';
    }
    namespace UnionMember2 {
        interface Trigger {
            source: string;
        }
    }
    interface UnionMember3 {
        end: string;
        error: UnionMember3.Error | null;
        finished: boolean;
        name: string;
        output: unknown | string | number | boolean;
        start: string;
        type: 'waitForEvent';
    }
    namespace UnionMember3 {
        interface Error {
            message: string;
            name: string;
        }
    }
    interface Trigger {
        source: 'unknown' | 'api' | 'binding' | 'event' | 'cron';
    }
}
export interface InstanceCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    instance_id?: string;
    /**
     * Body param:
     */
    instance_retention?: unknown;
    /**
     * Body param:
     */
    params?: unknown;
}
export interface InstanceListParams extends V4PagePaginationArrayParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param: Accepts ISO 8601 with no timezone offsets and in UTC.
     */
    date_end?: string;
    /**
     * Query param: Accepts ISO 8601 with no timezone offsets and in UTC.
     */
    date_start?: string;
    /**
     * Query param:
     */
    status?: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
}
export interface InstanceBulkParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body?: Array<InstanceBulkParams.Body>;
}
export declare namespace InstanceBulkParams {
    interface Body {
        instance_id?: string;
        instance_retention?: unknown;
        params?: unknown;
    }
}
export interface InstanceGetParams {
    account_id: string;
}
export declare namespace Instances {
    export { type InstanceCreateResponse as InstanceCreateResponse, type InstanceListResponse as InstanceListResponse, type InstanceBulkResponse as InstanceBulkResponse, type InstanceGetResponse as InstanceGetResponse, InstanceListResponsesV4PagePaginationArray as InstanceListResponsesV4PagePaginationArray, InstanceBulkResponsesSinglePage as InstanceBulkResponsesSinglePage, type InstanceCreateParams as InstanceCreateParams, type InstanceListParams as InstanceListParams, type InstanceBulkParams as InstanceBulkParams, type InstanceGetParams as InstanceGetParams, };
    export { Status as Status, type StatusEditResponse as StatusEditResponse, type StatusEditParams as StatusEditParams, };
    export { Events as Events, type EventCreateResponse as EventCreateResponse, type EventCreateParams as EventCreateParams, };
}
//# sourceMappingURL=instances.d.ts.map