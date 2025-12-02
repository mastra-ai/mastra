// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Insights extends APIResource {
    /**
     * Adds an insight to an event
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.create(
     *     'event_id',
     *     {
     *       account_id: 'account_id',
     *       content:
     *         'Here is some additional context _in markdown_',
     *     },
     *   );
     * ```
     */
    create(eventId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/create`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes an event insight
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.delete(
     *     'event_id',
     *     'insight_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId, insightId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an event insight
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.insights.edit(
     *     'event_id',
     *     'insight_id',
     *     {
     *       account_id: 'account_id',
     *       content:
     *         'Updated: Here is some additional context _in markdown_',
     *     },
     *   );
     * ```
     */
    edit(eventId, insightId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Reads an event insight
     *
     * @example
     * ```ts
     * const insight =
     *   await client.cloudforceOne.threatEvents.insights.get(
     *     'event_id',
     *     'insight_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(eventId, insightId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/${eventId}/insight/${insightId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=insights.mjs.map