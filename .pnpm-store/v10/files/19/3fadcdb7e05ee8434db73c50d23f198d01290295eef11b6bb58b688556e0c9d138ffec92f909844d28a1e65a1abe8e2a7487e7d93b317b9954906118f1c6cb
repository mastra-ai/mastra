// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Operations extends APIResource {
    /**
     * Retrieves all operations from the schema. Operations that already exist in API
     * Shield Endpoint Management will be returned as full operations.
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    list(schemaId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}/operations`, OperationListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
//# sourceMappingURL=operations.mjs.map