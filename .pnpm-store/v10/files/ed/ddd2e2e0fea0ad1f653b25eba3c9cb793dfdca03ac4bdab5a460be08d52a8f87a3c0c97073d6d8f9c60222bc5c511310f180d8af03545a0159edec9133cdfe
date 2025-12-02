// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ConfigsAPI from "./configs/configs.mjs";
import { Configs, } from "./configs/configs.mjs";
import * as RulesAPI from "./rules/rules.mjs";
import { MagicNetworkMonitoringRulesSinglePage, Rules, } from "./rules/rules.mjs";
import * as VPCFlowsAPI from "./vpc-flows/vpc-flows.mjs";
import { VPCFlows } from "./vpc-flows/vpc-flows.mjs";
export class MagicNetworkMonitoring extends APIResource {
    constructor() {
        super(...arguments);
        this.vpcFlows = new VPCFlowsAPI.VPCFlows(this._client);
        this.configs = new ConfigsAPI.Configs(this._client);
        this.rules = new RulesAPI.Rules(this._client);
    }
}
MagicNetworkMonitoring.VPCFlows = VPCFlows;
MagicNetworkMonitoring.Configs = Configs;
MagicNetworkMonitoring.Rules = Rules;
MagicNetworkMonitoring.MagicNetworkMonitoringRulesSinglePage = MagicNetworkMonitoringRulesSinglePage;
//# sourceMappingURL=magic-network-monitoring.mjs.map