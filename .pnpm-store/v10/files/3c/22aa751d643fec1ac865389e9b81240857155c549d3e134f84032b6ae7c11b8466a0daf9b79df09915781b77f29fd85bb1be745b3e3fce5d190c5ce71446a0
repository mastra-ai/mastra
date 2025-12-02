"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostnameAssociations = void 0;
const resource_1 = require("../../resource.js");
class HostnameAssociations extends resource_1.APIResource {
    /**
     * Replace Hostname Associations
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/certificate_authorities/hostname_associations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Hostname Associations
     */
    get(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/certificate_authorities/hostname_associations`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.HostnameAssociations = HostnameAssociations;
//# sourceMappingURL=hostname-associations.js.map