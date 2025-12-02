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
exports.OperationBulkCreateResponsesSinglePage = exports.OperationListResponsesV4PagePaginationArray = exports.Operations = void 0;
const resource_1 = require("../../../resource.js");
const SchemaValidationAPI = __importStar(require("./schema-validation.js"));
const schema_validation_1 = require("./schema-validation.js");
const pagination_1 = require("../../../pagination.js");
class Operations extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.schemaValidation = new SchemaValidationAPI.SchemaValidation(this._client);
    }
    /**
     * Add one operation to a zone. Endpoints can contain path variables. Host, method,
     * endpoint will be normalized to a canoncial form when creating an operation and
     * must be unique on the zone. Inserting an operation that matches an existing one
     * will return the record of the already existing operation and update its
     * last_updated date.
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.create(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     endpoint: '/api/v1/users/{var1}',
     *     host: 'www.example.com',
     *     method: 'GET',
     *   },
     * );
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/api_gateway/operations/item`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve information about all operations on a zone
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationListResponse of client.apiGateway.operations.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/operations`, OperationListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete an operation
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(operationId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/api_gateway/operations/${operationId}`, options);
    }
    /**
     * Add one or more operations to a zone. Endpoints can contain path variables.
     * Host, method, endpoint will be normalized to a canoncial form when creating an
     * operation and must be unique on the zone. Inserting an operation that matches an
     * existing one will return the record of the already existing operation and update
     * its last_updated date.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const operationBulkCreateResponse of client.apiGateway.operations.bulkCreate(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: [
     *       {
     *         endpoint: '/api/v1/users/{var1}',
     *         host: 'www.example.com',
     *         method: 'GET',
     *       },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    bulkCreate(params, options) {
        const { zone_id, body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/operations`, OperationBulkCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
    /**
     * Delete multiple operations
     *
     * @example
     * ```ts
     * const response =
     *   await client.apiGateway.operations.bulkDelete({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    bulkDelete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/api_gateway/operations`, options);
    }
    /**
     * Retrieve information about an operation
     *
     * @example
     * ```ts
     * const operation = await client.apiGateway.operations.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(operationId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/operations/${operationId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Operations = Operations;
class OperationListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
class OperationBulkCreateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.OperationBulkCreateResponsesSinglePage = OperationBulkCreateResponsesSinglePage;
Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
Operations.OperationBulkCreateResponsesSinglePage = OperationBulkCreateResponsesSinglePage;
Operations.SchemaValidation = schema_validation_1.SchemaValidation;
//# sourceMappingURL=operations.js.map