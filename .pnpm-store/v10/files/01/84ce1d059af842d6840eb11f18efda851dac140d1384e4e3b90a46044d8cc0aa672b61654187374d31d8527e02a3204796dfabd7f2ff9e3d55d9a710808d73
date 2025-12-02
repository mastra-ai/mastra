"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessUsersSinglePage = exports.UserListResponsesSinglePage = exports.Users = void 0;
const resource_1 = require("../../../../resource.js");
const ActiveSessionsAPI = __importStar(require("./active-sessions.js"));
const active_sessions_1 = require("./active-sessions.js");
const FailedLoginsAPI = __importStar(require("./failed-logins.js"));
const failed_logins_1 = require("./failed-logins.js");
const LastSeenIdentityAPI = __importStar(require("./last-seen-identity.js"));
const last_seen_identity_1 = require("./last-seen-identity.js");
const pagination_1 = require("../../../../pagination.js");
class Users extends resource_1.APIResource {
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
exports.Users = Users;
class UserListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.UserListResponsesSinglePage = UserListResponsesSinglePage;
class AccessUsersSinglePage extends pagination_1.SinglePage {
}
exports.AccessUsersSinglePage = AccessUsersSinglePage;
Users.UserListResponsesSinglePage = UserListResponsesSinglePage;
Users.ActiveSessions = active_sessions_1.ActiveSessions;
Users.ActiveSessionListResponsesSinglePage = active_sessions_1.ActiveSessionListResponsesSinglePage;
Users.LastSeenIdentity = last_seen_identity_1.LastSeenIdentity;
Users.FailedLogins = failed_logins_1.FailedLogins;
Users.FailedLoginListResponsesSinglePage = failed_logins_1.FailedLoginListResponsesSinglePage;
//# sourceMappingURL=users.js.map