// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DetailsAPI from "./details.mjs";
import { Details } from "./details.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Events extends APIResource {
    constructor() {
        super(...arguments);
        this.details = new DetailsAPI.Details(this._client);
    }
    /**
     * Only available for the Waiting Room Advanced subscription. Creates an event for
     * a waiting room. An event takes place during a specified period of time,
     * temporarily changing the behavior of a waiting room. While the event is active,
     * some of the properties in the event's configuration may either override or
     * inherit from the waiting room's configuration. Note that events cannot overlap
     * with each other, so only one event can be active at a time.
     *
     * @example
     * ```ts
     * const event = await client.waitingRooms.events.create(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     event_end_time: '2021-09-28T17:00:00.000Z',
     *     event_start_time: '2021-09-28T15:30:00.000Z',
     *     name: 'production_webinar_event',
     *   },
     * );
     * ```
     */
    create(waitingRoomId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured event for a waiting room.
     *
     * @example
     * ```ts
     * const event = await client.waitingRooms.events.update(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     event_end_time: '2021-09-28T17:00:00.000Z',
     *     event_start_time: '2021-09-28T15:30:00.000Z',
     *     name: 'production_webinar_event',
     *   },
     * );
     * ```
     */
    update(waitingRoomId, eventId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events/${eventId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists events for a waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const event of client.waitingRooms.events.list(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(waitingRoomId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events`, EventsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes an event for a waiting room.
     *
     * @example
     * ```ts
     * const event = await client.waitingRooms.events.delete(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(waitingRoomId, eventId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events/${eventId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches a configured event for a waiting room.
     *
     * @example
     * ```ts
     * const event = await client.waitingRooms.events.edit(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     event_end_time: '2021-09-28T17:00:00.000Z',
     *     event_start_time: '2021-09-28T15:30:00.000Z',
     *     name: 'production_webinar_event',
     *   },
     * );
     * ```
     */
    edit(waitingRoomId, eventId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events/${eventId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single configured event for a waiting room.
     *
     * @example
     * ```ts
     * const event = await client.waitingRooms.events.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(waitingRoomId, eventId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events/${eventId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class EventsV4PagePaginationArray extends V4PagePaginationArray {
}
Events.EventsV4PagePaginationArray = EventsV4PagePaginationArray;
Events.Details = Details;
//# sourceMappingURL=events.mjs.map