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
exports.Firewall = void 0;
const resource_1 = require("../../resource.js");
const AccessRulesAPI = __importStar(require("./access-rules.js"));
const access_rules_1 = require("./access-rules.js");
const LockdownsAPI = __importStar(require("./lockdowns.js"));
const lockdowns_1 = require("./lockdowns.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const UARulesAPI = __importStar(require("./ua-rules.js"));
const ua_rules_1 = require("./ua-rules.js");
const WAFAPI = __importStar(require("./waf/waf.js"));
const waf_1 = require("./waf/waf.js");
class Firewall extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.lockdowns = new LockdownsAPI.Lockdowns(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.accessRules = new AccessRulesAPI.AccessRules(this._client);
        this.uaRules = new UARulesAPI.UARules(this._client);
        this.waf = new WAFAPI.WAF(this._client);
    }
}
exports.Firewall = Firewall;
Firewall.Lockdowns = lockdowns_1.Lockdowns;
Firewall.LockdownsV4PagePaginationArray = lockdowns_1.LockdownsV4PagePaginationArray;
Firewall.Rules = rules_1.Rules;
Firewall.FirewallRulesSinglePage = rules_1.FirewallRulesSinglePage;
Firewall.FirewallRulesV4PagePaginationArray = rules_1.FirewallRulesV4PagePaginationArray;
Firewall.AccessRules = access_rules_1.AccessRules;
Firewall.AccessRuleListResponsesV4PagePaginationArray = access_rules_1.AccessRuleListResponsesV4PagePaginationArray;
Firewall.UARules = ua_rules_1.UARules;
Firewall.UARuleListResponsesV4PagePaginationArray = ua_rules_1.UARuleListResponsesV4PagePaginationArray;
Firewall.WAF = waf_1.WAF;
//# sourceMappingURL=firewall.js.map