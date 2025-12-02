"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsV4PagePaginationArray = exports.AuditLogs = void 0;
const resource_1 = require("../resource.js");
const shared_1 = require("./shared.js");
Object.defineProperty(exports, "AuditLogsV4PagePaginationArray", { enumerable: true, get: function () { return shared_1.AuditLogsV4PagePaginationArray; } });
class AuditLogs extends resource_1.APIResource {
    /**
     * Gets a list of audit logs for an account. Can be filtered by who made the
     * change, on which zone, and the timeframe of the change.
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/audit_logs`, shared_1.AuditLogsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
}
exports.AuditLogs = AuditLogs;
//# sourceMappingURL=audit-logs.js.map