import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as UsersAPI from "../../access/users/users.js";
import { AccessUsersSinglePage } from "../../access/users/users.js";
export declare class Users extends APIResource {
    /**
     * Lists SCIM User resources synced to Cloudflare via the System for Cross-domain
     * Identity Management (SCIM).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const accessUser of client.zeroTrust.identityProviders.scim.users.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(identityProviderId: string, params: UserListParams, options?: Core.RequestOptions): Core.PagePromise<AccessUsersSinglePage, UsersAPI.AccessUser>;
}
export interface UserListParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Query param: The unique Cloudflare-generated Id of the SCIM User resource; also
     * known as the "Id".
     */
    cf_resource_id?: string;
    /**
     * Query param: The email address of the SCIM User resource.
     */
    email?: string;
    /**
     * Query param: The IdP-generated Id of the SCIM User resource; also known as the
     * "external Id".
     */
    idp_resource_id?: string;
    /**
     * Query param: The name of the SCIM User resource.
     */
    name?: string;
    /**
     * Query param: The username of the SCIM User resource.
     */
    username?: string;
}
export declare namespace Users {
    export { type UserListParams as UserListParams };
}
export { AccessUsersSinglePage };
//# sourceMappingURL=users.d.ts.map