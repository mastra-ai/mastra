import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class FailedLogins extends APIResource {
    /**
     * Get all failed login attempts for a single user.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const failedLoginListResponse of client.zeroTrust.access.users.failedLogins.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(userId: string, params: FailedLoginListParams, options?: Core.RequestOptions): Core.PagePromise<FailedLoginListResponsesSinglePage, FailedLoginListResponse>;
}
export declare class FailedLoginListResponsesSinglePage extends SinglePage<FailedLoginListResponse> {
}
export interface FailedLoginListResponse {
    expiration?: number;
    metadata?: unknown;
}
export interface FailedLoginListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace FailedLogins {
    export { type FailedLoginListResponse as FailedLoginListResponse, FailedLoginListResponsesSinglePage as FailedLoginListResponsesSinglePage, type FailedLoginListParams as FailedLoginListParams, };
}
//# sourceMappingURL=failed-logins.d.ts.map