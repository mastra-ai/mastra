// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Versions extends APIResource {
    /**
     * List deployed Workflow versions
     */
    list(workflowName, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workflows/${workflowName}/versions`, VersionListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Get Workflow version details
     */
    get(workflowName, versionId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workflows/${workflowName}/versions/${versionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class VersionListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Versions.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;
//# sourceMappingURL=versions.mjs.map