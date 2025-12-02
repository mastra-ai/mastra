"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGroupListResponsesSinglePage = exports.PermissionGroups = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const pagination_1 = require("../../../pagination.js");
class PermissionGroups extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.getAPIList('/user/tokens/permission_groups', PermissionGroupListResponsesSinglePage, {
            query,
            ...options,
        });
    }
}
exports.PermissionGroups = PermissionGroups;
class PermissionGroupListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
PermissionGroups.PermissionGroupListResponsesSinglePage = PermissionGroupListResponsesSinglePage;
//# sourceMappingURL=permission-groups.js.map