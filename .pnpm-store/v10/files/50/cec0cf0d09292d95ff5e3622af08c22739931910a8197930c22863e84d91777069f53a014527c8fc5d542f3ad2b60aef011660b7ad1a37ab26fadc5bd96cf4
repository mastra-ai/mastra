// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as SchemaValidationAPI from "./schema-validation.mjs";
import { SchemaValidation, } from "./schema-validation.mjs";
import { SinglePage, V4PagePaginationArray } from "../../../pagination.mjs";
export class Operations extends APIResource {
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
export class OperationListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
export class OperationBulkCreateResponsesSinglePage extends SinglePage {
}
Operations.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
Operations.OperationBulkCreateResponsesSinglePage = OperationBulkCreateResponsesSinglePage;
Operations.SchemaValidation = SchemaValidation;
//# sourceMappingURL=operations.mjs.map