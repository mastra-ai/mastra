// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { V4PagePagination } from "../../../pagination.mjs";
export class Issues extends APIResource {
    /**
     * Get Security Center Issues
     *
     * @deprecated
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/intel/attack-surface-report/issues`, IssueListResponsesV4PagePagination, { query, ...options });
    }
    /**
     * Get Security Center Issue Counts by Class
     *
     * @deprecated
     */
    class(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/class`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Archive Security Center Insight
     *
     * @deprecated
     */
    dismiss(issueId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/intel/attack-surface-report/${issueId}/dismiss`, {
            body,
            ...options,
        });
    }
    /**
     * Get Security Center Issue Counts by Severity
     *
     * @deprecated
     */
    severity(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/severity`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get Security Center Issue Counts by Type
     *
     * @deprecated
     */
    type(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/intel/attack-surface-report/issues/type`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class IssueListResponsesV4PagePagination extends V4PagePagination {
}
Issues.IssueListResponsesV4PagePagination = IssueListResponsesV4PagePagination;
//# sourceMappingURL=issues.mjs.map