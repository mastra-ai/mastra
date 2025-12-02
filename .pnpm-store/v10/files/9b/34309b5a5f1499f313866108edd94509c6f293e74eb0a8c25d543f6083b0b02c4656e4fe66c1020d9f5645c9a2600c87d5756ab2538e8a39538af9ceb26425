// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as PermissionGroupsAPI from "./permission-groups.mjs";
import { PermissionGroupListResponsesV4PagePaginationArray, PermissionGroups, } from "./permission-groups.mjs";
import * as ResourceGroupsAPI from "./resource-groups.mjs";
import { ResourceGroupListResponsesV4PagePaginationArray, ResourceGroups, } from "./resource-groups.mjs";
import * as UserGroupsAPI from "./user-groups/user-groups.mjs";
import { UserGroupListResponsesV4PagePaginationArray, UserGroups, } from "./user-groups/user-groups.mjs";
export class IAM extends APIResource {
    constructor() {
        super(...arguments);
        this.permissionGroups = new PermissionGroupsAPI.PermissionGroups(this._client);
        this.resourceGroups = new ResourceGroupsAPI.ResourceGroups(this._client);
        this.userGroups = new UserGroupsAPI.UserGroups(this._client);
    }
}
IAM.PermissionGroups = PermissionGroups;
IAM.PermissionGroupListResponsesV4PagePaginationArray = PermissionGroupListResponsesV4PagePaginationArray;
IAM.ResourceGroups = ResourceGroups;
IAM.ResourceGroupListResponsesV4PagePaginationArray = ResourceGroupListResponsesV4PagePaginationArray;
IAM.UserGroups = UserGroups;
IAM.UserGroupListResponsesV4PagePaginationArray = UserGroupListResponsesV4PagePaginationArray;
//# sourceMappingURL=iam.mjs.map