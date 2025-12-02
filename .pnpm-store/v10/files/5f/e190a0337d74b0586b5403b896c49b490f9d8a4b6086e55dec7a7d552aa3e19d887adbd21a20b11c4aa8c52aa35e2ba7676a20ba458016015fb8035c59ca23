// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class IssueTypes extends APIResource {
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
export class IssueTypeGetResponsesSinglePage extends SinglePage {
}
IssueTypes.IssueTypeGetResponsesSinglePage = IssueTypeGetResponsesSinglePage;
//# sourceMappingURL=issue-types.mjs.map