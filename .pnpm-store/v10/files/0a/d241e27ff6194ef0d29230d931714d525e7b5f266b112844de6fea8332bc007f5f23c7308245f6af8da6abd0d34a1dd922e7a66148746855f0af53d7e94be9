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
exports.WAF = void 0;
const resource_1 = require("../../../resource.js");
const OverridesAPI = __importStar(require("./overrides.js"));
const overrides_1 = require("./overrides.js");
const PackagesAPI = __importStar(require("./packages/packages.js"));
const packages_1 = require("./packages/packages.js");
/**
 * @deprecated WAF managed rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#waf-managed-rules-apis-previous-version for full details.
 */
class WAF extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.overrides = new OverridesAPI.Overrides(this._client);
        this.packages = new PackagesAPI.Packages(this._client);
    }
}
exports.WAF = WAF;
WAF.Overrides = overrides_1.Overrides;
WAF.OverridesV4PagePaginationArray = overrides_1.OverridesV4PagePaginationArray;
WAF.Packages = packages_1.Packages;
WAF.PackageListResponsesV4PagePaginationArray = packages_1.PackageListResponsesV4PagePaginationArray;
//# sourceMappingURL=waf.js.map