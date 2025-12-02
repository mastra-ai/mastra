import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Invites extends APIResource {
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
    list(options?: Core.RequestOptions): Core.PagePromise<InvitesSinglePage, Invite>;
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
    edit(inviteId: string, body: InviteEditParams, options?: Core.RequestOptions): Core.APIPromise<Invite>;
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
    get(inviteId: string, options?: Core.RequestOptions): Core.APIPromise<Invite>;
}
export declare class InvitesSinglePage extends SinglePage<Invite> {
}
export interface Invite {
    /**
     * ID of the user to add to the organization.
     */
    invited_member_id: string | null;
    /**
     * ID of the organization the user will be added to.
     */
    organization_id: string;
    /**
     * Invite identifier tag.
     */
    id?: string;
    /**
     * When the invite is no longer active.
     */
    expires_on?: string;
    /**
     * The email address of the user who created the invite.
     */
    invited_by?: string;
    /**
     * Email address of the user to add to the organization.
     */
    invited_member_email?: string;
    /**
     * When the invite was sent.
     */
    invited_on?: string;
    organization_is_enforcing_twofactor?: boolean;
    /**
     * Organization name.
     */
    organization_name?: string;
    /**
     * List of role names the membership has for this account.
     */
    roles?: Array<string>;
    /**
     * Current status of the invitation.
     */
    status?: 'pending' | 'accepted' | 'rejected' | 'expired';
}
export interface InviteEditParams {
    /**
     * Status of your response to the invitation (rejected or accepted).
     */
    status: 'accepted' | 'rejected';
}
export declare namespace Invites {
    export { type Invite as Invite, InvitesSinglePage as InvitesSinglePage, type InviteEditParams as InviteEditParams, };
}
//# sourceMappingURL=invites.d.ts.map