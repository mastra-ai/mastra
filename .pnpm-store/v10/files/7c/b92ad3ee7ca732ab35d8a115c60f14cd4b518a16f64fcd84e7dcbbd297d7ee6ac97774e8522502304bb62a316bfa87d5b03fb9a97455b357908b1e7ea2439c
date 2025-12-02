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
exports.PackageListResponsesV4PagePaginationArray = exports.Packages = void 0;
const resource_1 = require("../../../../resource.js");
const GroupsAPI = __importStar(require("./groups.js"));
const groups_1 = require("./groups.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const pagination_1 = require("../../../../pagination.js");
class Packages extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.groups = new GroupsAPI.Groups(this._client);
        this.rules = new RulesAPI.Rules(this._client);
    }
    /**
     * Fetches WAF packages for a zone.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/waf/packages`, PackageListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Fetches the details of a WAF package.
     *
     * **Note:** Applies only to the
     * [previous version of WAF managed rules](https://developers.cloudflare.com/support/firewall/managed-rules-web-application-firewall-waf/understanding-waf-managed-rules-web-application-firewall/).
     *
     * @deprecated
     */
    get(packageId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/waf/packages/${packageId}`, options);
    }
}
exports.Packages = Packages;
class PackageListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.PackageListResponsesV4PagePaginationArray = PackageListResponsesV4PagePaginationArray;
Packages.PackageListResponsesV4PagePaginationArray = PackageListResponsesV4PagePaginationArray;
Packages.Groups = groups_1.Groups;
Packages.GroupsV4PagePaginationArray = groups_1.GroupsV4PagePaginationArray;
Packages.Rules = rules_1.Rules;
Packages.RuleListResponsesV4PagePaginationArray = rules_1.RuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=packages.js.map