"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationListResponsesV4PagePaginationArray = exports.Operations = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Operations extends resource_1.APIResource {
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
exports.Operations = Operations;
class OperationListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
//# sourceMappingURL=operations.js.map