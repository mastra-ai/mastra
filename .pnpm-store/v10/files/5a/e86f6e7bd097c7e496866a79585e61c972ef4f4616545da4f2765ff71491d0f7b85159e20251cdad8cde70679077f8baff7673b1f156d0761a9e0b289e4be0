"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionListResponsesV4PagePaginationArray = exports.Submissions = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Submissions extends resource_1.APIResource {
    /**
     * This endpoint returns information for submissions to made to reclassify emails.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const submissionListResponse of client.emailSecurity.submissions.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/submissions`, SubmissionListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.Submissions = Submissions;
class SubmissionListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.SubmissionListResponsesV4PagePaginationArray = SubmissionListResponsesV4PagePaginationArray;
Submissions.SubmissionListResponsesV4PagePaginationArray = SubmissionListResponsesV4PagePaginationArray;
//# sourceMappingURL=submissions.js.map