"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionListResponsesV4PagePaginationArray = exports.Versions = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Versions extends resource_1.APIResource {
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
exports.Versions = Versions;
class VersionListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;
Versions.VersionListResponsesV4PagePaginationArray = VersionListResponsesV4PagePaginationArray;
//# sourceMappingURL=versions.js.map