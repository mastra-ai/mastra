"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitesSinglePage = exports.Invites = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Invites extends resource_1.APIResource {
    /**
     * Lists all invitations associated with my user.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const invite of client.user.invites.list()) {
     *   // ...
     * }
     * ```
     */
    list(options) {
        return this._client.getAPIList('/user/invites', InvitesSinglePage, options);
    }
    /**
     * Responds to an invitation.
     *
     * @example
     * ```ts
     * const invite = await client.user.invites.edit(
     *   '4f5f0c14a2a41d5063dd301b2f829f04',
     *   { status: 'accepted' },
     * );
     * ```
     */
    edit(inviteId, body, options) {
        return this._client.patch(`/user/invites/${inviteId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets the details of an invitation.
     *
     * @example
     * ```ts
     * const invite = await client.user.invites.get(
     *   '4f5f0c14a2a41d5063dd301b2f829f04',
     * );
     * ```
     */
    get(inviteId, options) {
        return this._client.get(`/user/invites/${inviteId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Invites = Invites;
class InvitesSinglePage extends pagination_1.SinglePage {
}
exports.InvitesSinglePage = InvitesSinglePage;
Invites.InvitesSinglePage = InvitesSinglePage;
//# sourceMappingURL=invites.js.map