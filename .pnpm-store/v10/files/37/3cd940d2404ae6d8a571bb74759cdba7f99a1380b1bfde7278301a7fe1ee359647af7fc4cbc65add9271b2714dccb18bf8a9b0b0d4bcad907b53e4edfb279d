import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Statuses extends APIResource {
    /**
     * Fetches the status of a configured waiting room. Response fields include:
     *
     * 1. `status`: String indicating the status of the waiting room. The possible
     *    status are:
     *    - **not_queueing** indicates that the configured thresholds have not been met
     *      and all users are going through to the origin.
     *    - **queueing** indicates that the thresholds have been met and some users are
     *      held in the waiting room.
     *    - **event_prequeueing** indicates that an event is active and is currently
     *      prequeueing users before it starts.
     *    - **suspended** indicates that the room is suspended.
     * 2. `event_id`: String of the current event's `id` if an event is active,
     *    otherwise an empty string.
     * 3. `estimated_queued_users`: Integer of the estimated number of users currently
     *    waiting in the queue.
     * 4. `estimated_total_active_users`: Integer of the estimated number of users
     *    currently active on the origin.
     * 5. `max_estimated_time_minutes`: Integer of the maximum estimated time currently
     *    presented to the users.
     *
     * @example
     * ```ts
     * const status = await client.waitingRooms.statuses.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(waitingRoomId: string, params: StatusGetParams, options?: Core.RequestOptions): Core.APIPromise<StatusGetResponse>;
}
export interface StatusGetResponse {
    estimated_queued_users?: number;
    estimated_total_active_users?: number;
    event_id?: string;
    max_estimated_time_minutes?: number;
    status?: 'event_prequeueing' | 'not_queueing' | 'queueing' | 'suspended';
}
export interface StatusGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Statuses {
    export { type StatusGetResponse as StatusGetResponse, type StatusGetParams as StatusGetParams };
}
//# sourceMappingURL=statuses.d.ts.map