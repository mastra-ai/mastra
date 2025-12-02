// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ActiveSessionsAPI from "./active-sessions.mjs";
import { ActiveSessionListResponsesSinglePage, ActiveSessions, } from "./active-sessions.mjs";
import * as FailedLoginsAPI from "./failed-logins.mjs";
import { FailedLoginListResponsesSinglePage, FailedLogins, } from "./failed-logins.mjs";
import * as LastSeenIdentityAPI from "./last-seen-identity.mjs";
import { LastSeenIdentity } from "./last-seen-identity.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Users extends APIResource {
    constructor() {
        super(...arguments);
        this.activeSessions = new ActiveSessionsAPI.ActiveSessions(this._client);
        this.lastSeenIdentity = new LastSeenIdentityAPI.LastSeenIdentity(this._client);
        this.failedLogins = new FailedLoginsAPI.FailedLogins(this._client);
    }
    /**
     * Gets a list of users for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const userListResponse of client.zeroTrust.access.users.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/users`, UserListResponsesSinglePage, {
            query,
            ...options,
        });
    }
}
export class UserListResponsesSinglePage extends SinglePage {
}
export class AccessUsersSinglePage extends SinglePage {
}
Users.UserListResponsesSinglePage = UserListResponsesSinglePage;
Users.ActiveSessions = ActiveSessions;
Users.ActiveSessionListResponsesSinglePage = ActiveSessionListResponsesSinglePage;
Users.LastSeenIdentity = LastSeenIdentity;
Users.FailedLogins = FailedLogins;
Users.FailedLoginListResponsesSinglePage = FailedLoginListResponsesSinglePage;
//# sourceMappingURL=users.mjs.map