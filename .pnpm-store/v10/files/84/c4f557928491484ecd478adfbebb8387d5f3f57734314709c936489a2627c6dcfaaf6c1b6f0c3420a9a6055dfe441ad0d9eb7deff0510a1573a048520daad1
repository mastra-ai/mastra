"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relate = void 0;
const resource_1 = require("../../../resource.js");
class Relate extends resource_1.APIResource {
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
exports.Relate = Relate;
//# sourceMappingURL=relate.js.map