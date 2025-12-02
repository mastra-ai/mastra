// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class ActiveSessions extends APIResource {
    /**
     * Get active sessions for a single user.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const activeSessionListResponse of client.zeroTrust.access.users.activeSessions.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(userId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/users/${userId}/active_sessions`, ActiveSessionListResponsesSinglePage, options);
    }
    /**
     * Get an active session for a single user.
     *
     * @example
     * ```ts
     * const activeSession =
     *   await client.zeroTrust.access.users.activeSessions.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'X1aXj1lFVcqqyoXF',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(userId, nonce, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/users/${userId}/active_sessions/${nonce}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ActiveSessionListResponsesSinglePage extends SinglePage {
}
ActiveSessions.ActiveSessionListResponsesSinglePage = ActiveSessionListResponsesSinglePage;
//# sourceMappingURL=active-sessions.mjs.map