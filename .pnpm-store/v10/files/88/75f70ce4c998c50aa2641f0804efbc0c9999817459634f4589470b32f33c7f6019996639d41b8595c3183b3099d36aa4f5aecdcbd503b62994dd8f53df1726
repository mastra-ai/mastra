import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class EventTags extends APIResource {
    /**
     * Adds a tag to an event
     *
     * @example
     * ```ts
     * const eventTag =
     *   await client.cloudforceOne.threatEvents.eventTags.create(
     *     'event_id',
     *     { account_id: 'account_id', tags: ['botnet'] },
     *   );
     * ```
     */
    create(eventId: string, params: EventTagCreateParams, options?: Core.RequestOptions): Core.APIPromise<EventTagCreateResponse>;
    /**
     * Removes a tag from an event
     *
     * @example
     * ```ts
     * const eventTag =
     *   await client.cloudforceOne.threatEvents.eventTags.delete(
     *     'event_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId: string, params: EventTagDeleteParams, options?: Core.RequestOptions): Core.APIPromise<EventTagDeleteResponse>;
}
export interface EventTagCreateResponse {
    success: boolean;
}
export interface EventTagDeleteResponse {
    success: boolean;
}
export interface EventTagCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    tags: Array<string>;
}
export interface EventTagDeleteParams {
    /**
     * Account ID.
     */
    account_id: string;
}
export declare namespace EventTags {
    export { type EventTagCreateResponse as EventTagCreateResponse, type EventTagDeleteResponse as EventTagDeleteResponse, type EventTagCreateParams as EventTagCreateParams, type EventTagDeleteParams as EventTagDeleteParams, };
}
//# sourceMappingURL=event-tags.d.ts.map