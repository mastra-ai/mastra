// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import { AuditLogsV4PagePaginationArray } from "../shared.mjs";
export class AuditLogs extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/audit_logs', AuditLogsV4PagePaginationArray, { query, ...options });
    }
}
export { AuditLogsV4PagePaginationArray };
//# sourceMappingURL=audit-logs.mjs.map