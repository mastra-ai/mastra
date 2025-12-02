"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schedules = void 0;
const resource_1 = require("../../../resource.js");
class Schedules extends resource_1.APIResource {
    /**
     * Updates Cron Triggers for a Worker.
     *
     * @example
     * ```ts
     * const schedule =
     *   await client.workers.scripts.schedules.update(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       body: [{ cron: '* /30 * * * *' }],
     *     },
     *   );
     * ```
     */
    update(scriptName, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/workers/scripts/${scriptName}/schedules`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches Cron Triggers for a Worker.
     *
     * @example
     * ```ts
     * const schedule = await client.workers.scripts.schedules.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/schedules`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Schedules = Schedules;
//# sourceMappingURL=schedules.js.map