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
exports.SettingsPoliciesSinglePage = exports.FallbackDomainsSinglePage = exports.SplitTunnelIncludesSinglePage = exports.SplitTunnelExcludesSinglePage = exports.Policies = void 0;
const resource_1 = require("../../../../resource.js");
const CustomAPI = __importStar(require("./custom/custom.js"));
const custom_1 = require("./custom/custom.js");
const DefaultAPI = __importStar(require("./default/default.js"));
const default_1 = require("./default/default.js");
const pagination_1 = require("../../../../pagination.js");
class Policies extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.default = new DefaultAPI.Default(this._client);
        this.custom = new CustomAPI.Custom(this._client);
    }
}
exports.Policies = Policies;
class SplitTunnelExcludesSinglePage extends pagination_1.SinglePage {
}
exports.SplitTunnelExcludesSinglePage = SplitTunnelExcludesSinglePage;
class SplitTunnelIncludesSinglePage extends pagination_1.SinglePage {
}
exports.SplitTunnelIncludesSinglePage = SplitTunnelIncludesSinglePage;
class FallbackDomainsSinglePage extends pagination_1.SinglePage {
}
exports.FallbackDomainsSinglePage = FallbackDomainsSinglePage;
class SettingsPoliciesSinglePage extends pagination_1.SinglePage {
}
exports.SettingsPoliciesSinglePage = SettingsPoliciesSinglePage;
Policies.Default = default_1.Default;
Policies.Custom = custom_1.Custom;
//# sourceMappingURL=policies.js.map