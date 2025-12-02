"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Raw = void 0;
const resource_1 = require("../../../resource.js");
class Raw extends resource_1.APIResource {
    /**
     * Updates a raw event
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.raw.edit(
     *     'event_id',
     *     'raw_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(eventId, rawId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/${eventId}/raw/${rawId}`, {
            body,
            ...options,
        });
    }
    /**
     * Reads data for a raw event
     *
     * @example
     * ```ts
     * const raw = await client.cloudforceOne.threatEvents.raw.get(
     *   'event_id',
     *   'raw_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(eventId, rawId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/${eventId}/raw/${rawId}`, options);
    }
}
exports.Raw = Raw;
//# sourceMappingURL=raw.js.map