"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicSchemasV4PagePaginationArray = exports.UserSchemas = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
const HostsAPI = __importStar(require("./hosts.js"));
const hosts_1 = require("./hosts.js");
const OperationsAPI = __importStar(require("./operations.js"));
const operations_1 = require("./operations.js");
const pagination_1 = require("../../../pagination.js");
class UserSchemas extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.operations = new OperationsAPI.Operations(this._client);
        this.hosts = new HostsAPI.Hosts(this._client);
    }
    /**
     * Upload a schema to a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/api_gateway/user_schemas`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve information about all schemas on a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/user_schemas`, PublicSchemasV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a schema
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    delete(schemaId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, options);
    }
    /**
     * Enable validation for a schema
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    edit(schemaId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve information about a specific schema on a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    get(schemaId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.UserSchemas = UserSchemas;
class PublicSchemasV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.PublicSchemasV4PagePaginationArray = PublicSchemasV4PagePaginationArray;
UserSchemas.PublicSchemasV4PagePaginationArray = PublicSchemasV4PagePaginationArray;
UserSchemas.Operations = operations_1.Operations;
UserSchemas.OperationListResponsesV4PagePaginationArray = operations_1.OperationListResponsesV4PagePaginationArray;
UserSchemas.Hosts = hosts_1.Hosts;
UserSchemas.HostListResponsesV4PagePaginationArray = hosts_1.HostListResponsesV4PagePaginationArray;
//# sourceMappingURL=user-schemas.js.map