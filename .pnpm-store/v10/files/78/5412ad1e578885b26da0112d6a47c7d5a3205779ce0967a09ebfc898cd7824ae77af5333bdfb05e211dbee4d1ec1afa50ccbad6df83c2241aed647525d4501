// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class SchemaValidation extends APIResource {
    /**
     * Updates operation-level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    update(operationId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/api_gateway/operations/${operationId}/schema_validation`, {
            body,
            ...options,
        });
    }
    /**
     * Updates multiple operation-level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    edit(params, options) {
        const { zone_id, settings_multiple_request } = params;
        return this._client.patch(`/zones/${zone_id}/api_gateway/operations/schema_validation`, {
            body: settings_multiple_request,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves operation-level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    get(operationId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/operations/${operationId}/schema_validation`, options);
    }
}
//# sourceMappingURL=schema-validation.mjs.map