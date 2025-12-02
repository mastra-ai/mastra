"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Details = void 0;
const resource_1 = require("../../../resource.js");
class Details extends resource_1.APIResource {
    /**
     * Previews an event's configuration as if it was active. Inherited fields from the
     * waiting room will be displayed with their current values.
     *
     * @example
     * ```ts
     * const detail = await client.waitingRooms.events.details.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(waitingRoomId, eventId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/events/${eventId}/details`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Details = Details;
//# sourceMappingURL=details.js.map