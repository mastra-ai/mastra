// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Resources extends APIResource {
    /**
     * List resources in the Resource Catalog (Closed Beta).
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/resources`, ResourceListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Export resources in the Resource Catalog as a JSON file (Closed Beta).
     */
    export(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/resources/export`, {
            query,
            ...options,
            headers: { Accept: 'application/octet-stream', ...options?.headers },
            __binaryResponse: true,
        });
    }
    /**
     * Read an resource from the Resource Catalog (Closed Beta).
     */
    get(resourceId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/resources/${resourceId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Preview Rego query result against the latest resource catalog (Closed Beta).
     */
    policyPreview(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/resources/policy-preview`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class ResourceListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Resources.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;
//# sourceMappingURL=resources.mjs.map