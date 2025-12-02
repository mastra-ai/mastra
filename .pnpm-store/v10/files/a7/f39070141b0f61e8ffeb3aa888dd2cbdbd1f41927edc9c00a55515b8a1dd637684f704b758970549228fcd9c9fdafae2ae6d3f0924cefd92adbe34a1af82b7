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
exports.WaitingRoomsV4PagePaginationArray = exports.WaitingRooms = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const PageAPI = __importStar(require("./page.js"));
const page_1 = require("./page.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const StatusesAPI = __importStar(require("./statuses.js"));
const statuses_1 = require("./statuses.js");
const EventsAPI = __importStar(require("./events/events.js"));
const events_1 = require("./events/events.js");
const error_1 = require("../../error.js");
const pagination_1 = require("../../pagination.js");
class WaitingRooms extends resource_1.APIResource {
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
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
exports.WaitingRooms = WaitingRooms;
class WaitingRoomsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.WaitingRoomsV4PagePaginationArray = WaitingRoomsV4PagePaginationArray;
WaitingRooms.WaitingRoomsV4PagePaginationArray = WaitingRoomsV4PagePaginationArray;
WaitingRooms.Page = page_1.Page;
WaitingRooms.Events = events_1.Events;
WaitingRooms.EventsV4PagePaginationArray = events_1.EventsV4PagePaginationArray;
WaitingRooms.Rules = rules_1.Rules;
WaitingRooms.WaitingRoomRulesSinglePage = rules_1.WaitingRoomRulesSinglePage;
WaitingRooms.Statuses = statuses_1.Statuses;
WaitingRooms.Settings = settings_1.Settings;
//# sourceMappingURL=waiting-rooms.js.map