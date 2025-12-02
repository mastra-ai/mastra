// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Submissions extends APIResource {
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
export class SubmissionListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Submissions.SubmissionListResponsesV4PagePaginationArray = SubmissionListResponsesV4PagePaginationArray;
//# sourceMappingURL=submissions.mjs.map