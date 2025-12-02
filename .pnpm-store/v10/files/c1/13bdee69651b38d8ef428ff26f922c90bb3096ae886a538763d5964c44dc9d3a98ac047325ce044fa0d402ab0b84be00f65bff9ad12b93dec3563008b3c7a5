// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Schemas extends APIResource {
    /**
     * Upload a schema
     *
     * @example
     * ```ts
     * const schema = await client.schemaValidation.schemas.create(
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     kind: 'openapi_v3',
     *     name: 'petstore schema',
     *     source: '<schema file contents>',
     *     validation_enabled: true,
     *   },
     * );
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/schema_validation/schemas`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all uploaded schemas
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const schemaListResponse of client.schemaValidation.schemas.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/schema_validation/schemas`, SchemaListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a schema
     *
     * @example
     * ```ts
     * const schema = await client.schemaValidation.schemas.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(schemaId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/schema_validation/schemas/${schemaId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit details of a schema to enable validation
     *
     * @example
     * ```ts
     * const response = await client.schemaValidation.schemas.edit(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(schemaId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/schema_validation/schemas/${schemaId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get details of a schema
     *
     * @example
     * ```ts
     * const schema = await client.schemaValidation.schemas.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(schemaId, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/schema_validation/schemas/${schemaId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class SchemaListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Schemas.SchemaListResponsesV4PagePaginationArray = SchemaListResponsesV4PagePaginationArray;
//# sourceMappingURL=schemas.mjs.map