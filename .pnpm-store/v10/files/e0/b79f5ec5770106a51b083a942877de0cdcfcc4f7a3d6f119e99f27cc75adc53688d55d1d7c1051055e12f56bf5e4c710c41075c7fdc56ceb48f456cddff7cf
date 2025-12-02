"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tail = void 0;
const resource_1 = require("../../../resource.js");
class Tail extends resource_1.APIResource {
    /**
     * Starts a tail that receives logs and exception from a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.create(
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/tails`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a tail from a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.delete(
     *   'this-is_my_script-01',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(scriptName, id, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}/tails/${id}`, options);
    }
    /**
     * Get list of tails currently deployed on a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/tails`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Tail = Tail;
//# sourceMappingURL=tail.js.map