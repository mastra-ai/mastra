"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogListResponsesSinglePage = exports.Logs = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Logs extends resource_1.APIResource {
    /**
     * Get job logs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logListResponse of client.r2.superSlurper.jobs.logs.list(
     *   'job_id',
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(jobId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/slurper/jobs/${jobId}/logs`, LogListResponsesSinglePage, { query, ...options });
    }
}
exports.Logs = Logs;
class LogListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.LogListResponsesSinglePage = LogListResponsesSinglePage;
Logs.LogListResponsesSinglePage = LogListResponsesSinglePage;
//# sourceMappingURL=logs.js.map