// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
import * as HostsAPI from "./hosts.mjs";
import { HostListResponsesV4PagePaginationArray, Hosts } from "./hosts.mjs";
import * as OperationsAPI from "./operations.mjs";
import { OperationListResponsesV4PagePaginationArray, Operations, } from "./operations.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class UserSchemas extends APIResource {
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
export class PublicSchemasV4PagePaginationArray extends V4PagePaginationArray {
}
UserSchemas.PublicSchemasV4PagePaginationArray = PublicSchemasV4PagePaginationArray;
UserSchemas.Operations = Operations;
UserSchemas.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
UserSchemas.Hosts = Hosts;
UserSchemas.HostListResponsesV4PagePaginationArray = HostListResponsesV4PagePaginationArray;
//# sourceMappingURL=user-schemas.mjs.map