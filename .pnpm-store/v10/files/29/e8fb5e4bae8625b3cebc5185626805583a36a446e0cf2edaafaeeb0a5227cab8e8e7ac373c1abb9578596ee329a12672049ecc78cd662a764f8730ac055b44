"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TURNListResponsesSinglePage = exports.TURN = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class TURN extends resource_1.APIResource {
    /**
     * Creates a new Cloudflare Calls TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/calls/turn_keys`, { body, ...options });
    }
    /**
     * Edit details for a single TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.update(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(keyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/calls/turn_keys/${keyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all TURN keys in the Cloudflare account
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const turnListResponse of client.calls.turn.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/calls/turn_keys`, TURNListResponsesSinglePage, options);
    }
    /**
     * Deletes a TURN key from Cloudflare Calls
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.delete(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(keyId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/calls/turn_keys/${keyId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches details for a single TURN key.
     *
     * @example
     * ```ts
     * const turn = await client.calls.turn.get(
     *   '2a95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(keyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/calls/turn_keys/${keyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.TURN = TURN;
class TURNListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.TURNListResponsesSinglePage = TURNListResponsesSinglePage;
TURN.TURNListResponsesSinglePage = TURNListResponsesSinglePage;
//# sourceMappingURL=turn.js.map