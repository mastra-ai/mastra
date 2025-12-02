// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Invites extends APIResource {
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
export class InvitesSinglePage extends SinglePage {
}
Invites.InvitesSinglePage = InvitesSinglePage;
//# sourceMappingURL=invites.mjs.map