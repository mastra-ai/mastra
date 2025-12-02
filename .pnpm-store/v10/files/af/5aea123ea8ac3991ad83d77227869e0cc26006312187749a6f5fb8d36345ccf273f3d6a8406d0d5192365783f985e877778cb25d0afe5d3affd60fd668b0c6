// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Move extends APIResource {
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
export class MoveCreateResponsesSinglePage extends SinglePage {
}
export class MoveBulkResponsesSinglePage extends SinglePage {
}
Move.MoveCreateResponsesSinglePage = MoveCreateResponsesSinglePage;
Move.MoveBulkResponsesSinglePage = MoveBulkResponsesSinglePage;
//# sourceMappingURL=move.mjs.map