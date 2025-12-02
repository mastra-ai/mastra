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
exports.MagicNetworkMonitoring = void 0;
const resource_1 = require("../../resource.js");
const ConfigsAPI = __importStar(require("./configs/configs.js"));
const configs_1 = require("./configs/configs.js");
const RulesAPI = __importStar(require("./rules/rules.js"));
const rules_1 = require("./rules/rules.js");
const VPCFlowsAPI = __importStar(require("./vpc-flows/vpc-flows.js"));
const vpc_flows_1 = require("./vpc-flows/vpc-flows.js");
class MagicNetworkMonitoring extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.vpcFlows = new VPCFlowsAPI.VPCFlows(this._client);
        this.configs = new ConfigsAPI.Configs(this._client);
        this.rules = new RulesAPI.Rules(this._client);
    }
}
exports.MagicNetworkMonitoring = MagicNetworkMonitoring;
MagicNetworkMonitoring.VPCFlows = vpc_flows_1.VPCFlows;
MagicNetworkMonitoring.Configs = configs_1.Configs;
MagicNetworkMonitoring.Rules = rules_1.Rules;
MagicNetworkMonitoring.MagicNetworkMonitoringRulesSinglePage = rules_1.MagicNetworkMonitoringRulesSinglePage;
//# sourceMappingURL=magic-network-monitoring.js.map