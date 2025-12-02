"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueTypeGetResponsesSinglePage = exports.IssueTypes = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class IssueTypes extends resource_1.APIResource {
    /**
     * Get Security Center Issues Types
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const issueTypeGetResponse of client.intel.attackSurfaceReport.issueTypes.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/attack-surface-report/issue-types`, IssueTypeGetResponsesSinglePage, options);
    }
}
exports.IssueTypes = IssueTypes;
class IssueTypeGetResponsesSinglePage extends pagination_1.SinglePage {
}
exports.IssueTypeGetResponsesSinglePage = IssueTypeGetResponsesSinglePage;
IssueTypes.IssueTypeGetResponsesSinglePage = IssueTypeGetResponsesSinglePage;
//# sourceMappingURL=issue-types.js.map