// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import * as PageAPI from "./page.mjs";
import { Page } from "./page.mjs";
import * as RulesAPI from "./rules.mjs";
import { Rules, WaitingRoomRulesSinglePage, } from "./rules.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as StatusesAPI from "./statuses.mjs";
import { Statuses } from "./statuses.mjs";
import * as EventsAPI from "./events/events.mjs";
import { Events, EventsV4PagePaginationArray, } from "./events/events.mjs";
import { CloudflareError } from "../../error.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class WaitingRooms extends APIResource {
    constructor() {
        super(...arguments);
        this.page = new PageAPI.Page(this._client);
        this.events = new EventsAPI.Events(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.statuses = new StatusesAPI.Statuses(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
    }
    /**
     * Creates a new waiting room.
     *
     * @example
     * ```ts
     * const waitingRoom = await client.waitingRooms.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   host: 'shop.example.com',
     *   name: 'production_webinar',
     *   new_users_per_minute: 200,
     *   total_active_users: 200,
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/waiting_rooms`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured waiting room.
     *
     * @example
     * ```ts
     * const waitingRoom = await client.waitingRooms.update(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     host: 'shop.example.com',
     *     name: 'production_webinar',
     *     new_users_per_minute: 200,
     *     total_active_users: 200,
     *   },
     * );
     * ```
     */
    update(waitingRoomId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/waiting_rooms`, WaitingRoomsV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes a waiting room.
     *
     * @example
     * ```ts
     * const waitingRoom = await client.waitingRooms.delete(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(waitingRoomId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patches a configured waiting room.
     *
     * @example
     * ```ts
     * const waitingRoom = await client.waitingRooms.edit(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     host: 'shop.example.com',
     *     name: 'production_webinar',
     *     new_users_per_minute: 200,
     *     total_active_users: 200,
     *   },
     * );
     * ```
     */
    edit(waitingRoomId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single configured waiting room.
     *
     * @example
     * ```ts
     * const waitingRoom = await client.waitingRooms.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(waitingRoomId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WaitingRoomsV4PagePaginationArray extends V4PagePaginationArray {
}
WaitingRooms.WaitingRoomsV4PagePaginationArray = WaitingRoomsV4PagePaginationArray;
WaitingRooms.Page = Page;
WaitingRooms.Events = Events;
WaitingRooms.EventsV4PagePaginationArray = EventsV4PagePaginationArray;
WaitingRooms.Rules = Rules;
WaitingRooms.WaitingRoomRulesSinglePage = WaitingRoomRulesSinglePage;
WaitingRooms.Statuses = Statuses;
WaitingRooms.Settings = Settings;
//# sourceMappingURL=waiting-rooms.mjs.map