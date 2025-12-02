// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Relate extends APIResource {
    /**
     * Removes an event reference
     *
     * @example
     * ```ts
     * const relate =
     *   await client.cloudforceOne.threatEvents.relate.delete(
     *     'event_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(eventId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/events/relate/${eventId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=relate.mjs.map