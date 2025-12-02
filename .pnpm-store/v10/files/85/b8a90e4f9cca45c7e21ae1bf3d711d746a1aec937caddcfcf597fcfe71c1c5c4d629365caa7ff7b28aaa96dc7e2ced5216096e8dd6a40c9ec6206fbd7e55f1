"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveBulkResponsesSinglePage = exports.MoveCreateResponsesSinglePage = exports.Move = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Move extends resource_1.APIResource {
    /**
     * Move a message
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const moveCreateResponse of client.emailSecurity.investigate.move.create(
     *   '4Njp3P0STMz2c02Q',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination: 'Inbox',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(postfixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/investigate/${postfixId}/move`, MoveCreateResponsesSinglePage, { body, method: 'post', ...options });
    }
    /**
     * Move multiple messages
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const moveBulkResponse of client.emailSecurity.investigate.move.bulk(
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination: 'Inbox',
     *     postfix_ids: ['4Njp3P0STMz2c02Q'],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulk(params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/investigate/move`, MoveBulkResponsesSinglePage, { body, method: 'post', ...options });
    }
}
exports.Move = Move;
class MoveCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.MoveCreateResponsesSinglePage = MoveCreateResponsesSinglePage;
class MoveBulkResponsesSinglePage extends pagination_1.SinglePage {
}
exports.MoveBulkResponsesSinglePage = MoveBulkResponsesSinglePage;
Move.MoveCreateResponsesSinglePage = MoveCreateResponsesSinglePage;
Move.MoveBulkResponsesSinglePage = MoveBulkResponsesSinglePage;
//# sourceMappingURL=move.js.map