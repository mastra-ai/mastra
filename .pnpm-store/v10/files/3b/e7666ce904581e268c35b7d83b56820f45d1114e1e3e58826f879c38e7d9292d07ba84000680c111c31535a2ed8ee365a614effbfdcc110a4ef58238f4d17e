// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class SchemaValidation extends APIResource {
    /**
     * Updates zone level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/api_gateway/settings/schema_validation`, { body, ...options });
    }
    /**
     * Updates zone level schema validation settings on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/api_gateway/settings/schema_validation`, {
            body,
            ...options,
        });
    }
    /**
     * Retrieves zone level schema validation settings currently set on the zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/settings/schema_validation`, options);
    }
}
//# sourceMappingURL=schema-validation.mjs.map