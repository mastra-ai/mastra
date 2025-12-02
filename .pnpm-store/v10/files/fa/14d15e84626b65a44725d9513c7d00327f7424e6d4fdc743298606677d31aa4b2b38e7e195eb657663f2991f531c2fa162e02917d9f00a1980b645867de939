// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class Organizations extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
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
export class OrganizationsV4PagePaginationArray extends V4PagePaginationArray {
}
Organizations.OrganizationsV4PagePaginationArray = OrganizationsV4PagePaginationArray;
//# sourceMappingURL=organizations.mjs.map