import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as QueuesAPI from "./queues.js";
export declare class Purge extends APIResource {
    /**
     * Deletes all messages from the Queue.
     *
     * @example
     * ```ts
     * const queue = await client.queues.purge.start(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    start(queueId: string, params: PurgeStartParams, options?: Core.RequestOptions): Core.APIPromise<QueuesAPI.Queue>;
    /**
     * Get details about a Queue's purge status.
     *
     * @example
     * ```ts
     * const response = await client.queues.purge.status(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    status(queueId: string, params: PurgeStatusParams, options?: Core.RequestOptions): Core.APIPromise<PurgeStatusResponse>;
}
export interface PurgeStatusResponse {
    /**
     * Indicates if the last purge operation completed successfully.
     */
    completed?: string;
    /**
     * Timestamp when the last purge operation started.
     */
    started_at?: string;
}
export interface PurgeStartParams {
    /**
     * Path param: A Resource identifier.
     */
    account_id: string;
    /**
     * Body param: Confimation that all messages will be deleted permanently.
     */
    delete_messages_permanently?: boolean;
}
export interface PurgeStatusParams {
    /**
     * A Resource identifier.
     */
    account_id: string;
}
export declare namespace Purge {
    export { type PurgeStatusResponse as PurgeStatusResponse, type PurgeStartParams as PurgeStartParams, type PurgeStatusParams as PurgeStatusParams, };
}
//# sourceMappingURL=purge.d.ts.map