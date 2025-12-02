"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationsV4PagePaginationArray = exports.Organizations = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const pagination_1 = require("../../pagination.js");
class Organizations extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/organizations', OrganizationsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Removes association to an organization.
     *
     * @deprecated
     */
    delete(organizationId, options) {
        return this._client.delete(`/user/organizations/${organizationId}`, options);
    }
    /**
     * Gets a specific organization the user is associated with.
     *
     * @deprecated
     */
    get(organizationId, options) {
        return this._client.get(`/user/organizations/${organizationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Organizations = Organizations;
class OrganizationsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.OrganizationsV4PagePaginationArray = OrganizationsV4PagePaginationArray;
Organizations.OrganizationsV4PagePaginationArray = OrganizationsV4PagePaginationArray;
//# sourceMappingURL=organizations.js.map