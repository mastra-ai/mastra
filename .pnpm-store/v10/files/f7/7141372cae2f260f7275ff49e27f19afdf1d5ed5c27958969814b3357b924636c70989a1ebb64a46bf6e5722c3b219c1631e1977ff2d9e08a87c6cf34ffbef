"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IAM = void 0;
const resource_1 = require("../../resource.js");
const PermissionGroupsAPI = __importStar(require("./permission-groups.js"));
const permission_groups_1 = require("./permission-groups.js");
const ResourceGroupsAPI = __importStar(require("./resource-groups.js"));
const resource_groups_1 = require("./resource-groups.js");
const UserGroupsAPI = __importStar(require("./user-groups/user-groups.js"));
const user_groups_1 = require("./user-groups/user-groups.js");
class IAM extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.permissionGroups = new PermissionGroupsAPI.PermissionGroups(this._client);
        this.resourceGroups = new ResourceGroupsAPI.ResourceGroups(this._client);
        this.userGroups = new UserGroupsAPI.UserGroups(this._client);
    }
}
exports.IAM = IAM;
IAM.PermissionGroups = permission_groups_1.PermissionGroups;
IAM.PermissionGroupListResponsesV4PagePaginationArray = permission_groups_1.PermissionGroupListResponsesV4PagePaginationArray;
IAM.ResourceGroups = resource_groups_1.ResourceGroups;
IAM.ResourceGroupListResponsesV4PagePaginationArray = resource_groups_1.ResourceGroupListResponsesV4PagePaginationArray;
IAM.UserGroups = user_groups_1.UserGroups;
IAM.UserGroupListResponsesV4PagePaginationArray = user_groups_1.UserGroupListResponsesV4PagePaginationArray;
//# sourceMappingURL=iam.js.map