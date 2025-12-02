"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostListResponsesV4PagePaginationArray = exports.Hosts = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Hosts extends resource_1.APIResource {
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
exports.Hosts = Hosts;
class HostListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.HostListResponsesV4PagePaginationArray = HostListResponsesV4PagePaginationArray;
Hosts.HostListResponsesV4PagePaginationArray = HostListResponsesV4PagePaginationArray;
//# sourceMappingURL=hosts.js.map