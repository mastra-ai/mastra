"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsV4PagePaginationArray = exports.Events = void 0;
const resource_1 = require("../../../resource.js");
const DetailsAPI = __importStar(require("./details.js"));
const details_1 = require("./details.js");
const pagination_1 = require("../../../pagination.js");
class Events extends resource_1.APIResource {
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
exports.Events = Events;
class EventsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.EventsV4PagePaginationArray = EventsV4PagePaginationArray;
Events.EventsV4PagePaginationArray = EventsV4PagePaginationArray;
Events.Details = details_1.Details;
//# sourceMappingURL=events.js.map