// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Hosts extends APIResource {
    /**
     * Retrieve schema hosts in a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/api_gateway/user_schemas/hosts`, HostListResponsesV4PagePaginationArray, { query, ...options });
    }
}
export class HostListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Hosts.HostListResponsesV4PagePaginationArray = HostListResponsesV4PagePaginationArray;
//# sourceMappingURL=hosts.mjs.map