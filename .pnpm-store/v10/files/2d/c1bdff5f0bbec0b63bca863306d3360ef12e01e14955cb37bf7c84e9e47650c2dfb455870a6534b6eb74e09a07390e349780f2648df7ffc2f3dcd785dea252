import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as UserPolicyChecksAPI from "./user-policy-checks.js";
import * as ApplicationsAPI from "./applications.js";
export declare class UserPolicyChecks extends APIResource {
    /**
     * Tests if a specific user has permission to access an application.
     *
     * @example
     * ```ts
     * const userPolicyChecks =
     *   await client.zeroTrust.access.applications.userPolicyChecks.list(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    list(appId: ApplicationsAPI.AppIDParam, params?: UserPolicyCheckListParams, options?: Core.RequestOptions): Core.APIPromise<UserPolicyCheckListResponse>;
    list(appId: ApplicationsAPI.AppIDParam, options?: Core.RequestOptions): Core.APIPromise<UserPolicyCheckListResponse>;
}
export interface UserPolicyCheckGeo {
    country?: string;
}
export interface UserPolicyCheckListResponse {
    app_state?: UserPolicyCheckListResponse.AppState;
    user_identity?: UserPolicyCheckListResponse.UserIdentity;
}
export declare namespace UserPolicyCheckListResponse {
    interface AppState {
        /**
         * UUID.
         */
        app_uid?: string;
        aud?: string;
        hostname?: string;
        name?: string;
        policies?: Array<unknown>;
        status?: string;
    }
    interface UserIdentity {
        id?: string;
        account_id?: string;
        device_sessions?: unknown;
        email?: string;
        geo?: UserPolicyChecksAPI.UserPolicyCheckGeo;
        iat?: number;
        is_gateway?: boolean;
        is_warp?: boolean;
        name?: string;
        /**
         * UUID.
         */
        user_uuid?: string;
        version?: number;
    }
}
export interface UserPolicyCheckListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace UserPolicyChecks {
    export { type UserPolicyCheckGeo as UserPolicyCheckGeo, type UserPolicyCheckListResponse as UserPolicyCheckListResponse, type UserPolicyCheckListParams as UserPolicyCheckListParams, };
}
//# sourceMappingURL=user-policy-checks.d.ts.map