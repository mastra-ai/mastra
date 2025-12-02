// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class PermissionGroups extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/tokens/permission_groups', PermissionGroupListResponsesSinglePage, {
            query,
            ...options,
        });
    }
}
export class PermissionGroupListResponsesSinglePage extends SinglePage {
}
PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
//# sourceMappingURL=permission-groups.mjs.map