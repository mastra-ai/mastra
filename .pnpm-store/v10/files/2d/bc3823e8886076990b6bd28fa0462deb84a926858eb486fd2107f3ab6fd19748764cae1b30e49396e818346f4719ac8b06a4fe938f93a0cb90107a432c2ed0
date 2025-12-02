import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import * as Shared from "../shared.js";
import { AuditLogsV4PagePaginationArray } from "../shared.js";
import { type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class AuditLogs extends APIResource {
    /**
     * Gets a list of audit logs for a user account. Can be filtered by who made the
     * change, on which zone, and the timeframe of the change.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const auditLog of client.user.auditLogs.list()) {
     *   // ...
     * }
     * ```
     */
    list(query?: AuditLogListParams, options?: Core.RequestOptions): Core.PagePromise<AuditLogsV4PagePaginationArray, Shared.AuditLog>;
    list(options?: Core.RequestOptions): Core.PagePromise<AuditLogsV4PagePaginationArray, Shared.AuditLog>;
}
export interface AuditLogListParams extends V4PagePaginationArrayParams {
    /**
     * Finds a specific log by its ID.
     */
    id?: string;
    action?: AuditLogListParams.Action;
    actor?: AuditLogListParams.Actor;
    /**
     * Limits the returned results to logs older than the specified date. A `full-date`
     * that conforms to RFC3339.
     */
    before?: (string & {}) | (string & {});
    /**
     * Changes the direction of the chronological sorting.
     */
    direction?: 'desc' | 'asc';
    /**
     * Indicates that this request is an export of logs in CSV format.
     */
    export?: boolean;
    /**
     * Indicates whether or not to hide user level audit logs.
     */
    hide_user_logs?: boolean;
    /**
     * Limits the returned results to logs newer than the specified date. A `full-date`
     * that conforms to RFC3339.
     */
    since?: (string & {}) | (string & {});
    zone?: AuditLogListParams.Zone;
}
export declare namespace AuditLogListParams {
    interface Action {
        /**
         * Filters by the action type.
         */
        type?: string;
    }
    interface Actor {
        /**
         * Filters by the email address of the actor that made the change.
         */
        email?: string;
        /**
         * Filters by the IP address of the request that made the change by specific IP
         * address or valid CIDR Range.
         */
        ip?: string;
    }
    interface Zone {
        /**
         * Filters by the name of the zone associated to the change.
         */
        name?: string;
    }
}
export declare namespace AuditLogs {
    export { type AuditLogListParams as AuditLogListParams };
}
export { AuditLogsV4PagePaginationArray };
//# sourceMappingURL=audit-logs.d.ts.map