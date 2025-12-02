import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Status extends APIResource {
    /**
     * Change status of instance
     */
    edit(workflowName: string, instanceId: string, params: StatusEditParams, options?: Core.RequestOptions): Core.APIPromise<StatusEditResponse>;
}
export interface StatusEditResponse {
    status: 'queued' | 'running' | 'paused' | 'errored' | 'terminated' | 'complete' | 'waitingForPause' | 'waiting';
    /**
     * Accepts ISO 8601 with no timezone offsets and in UTC.
     */
    timestamp: string;
}
export interface StatusEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: Apply action to instance.
     */
    status: 'resume' | 'pause' | 'terminate';
}
export declare namespace Status {
    export { type StatusEditResponse as StatusEditResponse, type StatusEditParams as StatusEditParams };
}
//# sourceMappingURL=status.d.ts.map