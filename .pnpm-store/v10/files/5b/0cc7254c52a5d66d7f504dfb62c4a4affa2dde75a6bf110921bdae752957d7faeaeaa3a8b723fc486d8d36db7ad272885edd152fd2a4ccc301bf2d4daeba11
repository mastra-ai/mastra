"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsV4PagePaginationArray = exports.AuditLogs = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const shared_1 = require("../shared.js");
Object.defineProperty(exports, "AuditLogsV4PagePaginationArray", { enumerable: true, get: function () { return shared_1.AuditLogsV4PagePaginationArray; } });
class AuditLogs extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/audit_logs', shared_1.AuditLogsV4PagePaginationArray, { query, ...options });
    }
}
exports.AuditLogs = AuditLogs;
//# sourceMappingURL=audit-logs.js.map