"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitingRoomRulesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Only available for the Waiting Room Advanced subscription. Creates a rule for a
     * waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const waitingRoomRule of client.waitingRooms.rules.create(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     rules: {
     *       action: 'bypass_waiting_room',
     *       expression: 'ip.src in {10.20.30.40}',
     *     },
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(waitingRoomId, params, options) {
        const { zone_id, rules } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`, WaitingRoomRulesSinglePage, { body: rules, method: 'post', ...options });
    }
    /**
     * Only available for the Waiting Room Advanced subscription. Replaces all rules
     * for a waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const waitingRoomRule of client.waitingRooms.rules.update(
     *   '699d98642c564d2e855e9661899b7252',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     rules: [
     *       {
     *         action: 'bypass_waiting_room',
     *         expression: 'ip.src in {10.20.30.40}',
     *       },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(waitingRoomId, params, options) {
        const { zone_id, rules } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`, WaitingRoomRulesSinglePage, { body: rules, method: 'put', ...options });
    }
    /**
     * Deletes a rule for a waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const waitingRoomRule of client.waitingRooms.rules.delete(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(waitingRoomId, ruleId, params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules/${ruleId}`, WaitingRoomRulesSinglePage, { method: 'delete', ...options });
    }
    /**
     * Patches a rule for a waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const waitingRoomRule of client.waitingRooms.rules.edit(
     *   '699d98642c564d2e855e9661899b7252',
     *   '25756b2dfe6e378a06b033b670413757',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     action: 'bypass_waiting_room',
     *     expression: 'ip.src in {10.20.30.40}',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    edit(waitingRoomId, ruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules/${ruleId}`, WaitingRoomRulesSinglePage, { body, method: 'patch', ...options });
    }
    /**
     * Lists rules for a waiting room.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const waitingRoomRule of client.waitingRooms.rules.get(
     *   '699d98642c564d2e855e9661899b7252',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(waitingRoomId, params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/waiting_rooms/${waitingRoomId}/rules`, WaitingRoomRulesSinglePage, options);
    }
}
exports.Rules = Rules;
class WaitingRoomRulesSinglePage extends pagination_1.SinglePage {
}
exports.WaitingRoomRulesSinglePage = WaitingRoomRulesSinglePage;
Rules.WaitingRoomRulesSinglePage = WaitingRoomRulesSinglePage;
//# sourceMappingURL=rules.js.map