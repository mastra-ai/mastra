// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
import { AuditLogsV4PagePaginationArray } from "./shared.mjs";
export class AuditLogs extends APIResource {
    /**
     * Gets a list of audit logs for an account. Can be filtered by who made the
     * change, on which zone, and the timeframe of the change.
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/audit_logs`, AuditLogsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
}
export { AuditLogsV4PagePaginationArray };
//# sourceMappingURL=audit-logs.mjs.map