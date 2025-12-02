"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTags = void 0;
const resource_1 = require("../../../resource.js");
class EventTags extends resource_1.APIResource {
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
    create(eventId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/event_tag/${eventId}/create`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
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
    delete(eventId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/events/event_tag/${eventId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.EventTags = EventTags;
//# sourceMappingURL=event-tags.js.map