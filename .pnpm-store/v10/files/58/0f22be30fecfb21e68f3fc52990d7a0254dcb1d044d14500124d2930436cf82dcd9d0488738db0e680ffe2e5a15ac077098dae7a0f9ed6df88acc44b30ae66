// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Raw extends APIResource {
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
//# sourceMappingURL=raw.mjs.map