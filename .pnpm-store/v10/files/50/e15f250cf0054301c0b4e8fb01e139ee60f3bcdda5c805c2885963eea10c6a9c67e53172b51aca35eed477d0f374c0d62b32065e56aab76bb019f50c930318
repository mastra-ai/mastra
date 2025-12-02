"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crons = void 0;
const resource_1 = require("../../../resource.js");
class Crons extends resource_1.APIResource {
    /**
     * Reads the last cron update time
     *
     * @example
     * ```ts
     * const crons =
     *   await client.cloudforceOne.threatEvents.crons.list({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/cloudforce-one/events/cron`, options);
    }
    /**
     * Reads the last cron update time
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.threatEvents.crons.edit({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/events/cron`, options);
    }
}
exports.Crons = Crons;
//# sourceMappingURL=crons.js.map