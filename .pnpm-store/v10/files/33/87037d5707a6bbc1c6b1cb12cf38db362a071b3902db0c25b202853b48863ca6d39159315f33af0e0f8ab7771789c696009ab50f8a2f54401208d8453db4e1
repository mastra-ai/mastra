// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AccessRulesAPI from "./access-rules.mjs";
import { AccessRuleListResponsesV4PagePaginationArray, AccessRules, } from "./access-rules.mjs";
import * as LockdownsAPI from "./lockdowns.mjs";
import { Lockdowns, LockdownsV4PagePaginationArray, } from "./lockdowns.mjs";
import * as RulesAPI from "./rules.mjs";
import { FirewallRulesSinglePage, FirewallRulesV4PagePaginationArray, Rules, } from "./rules.mjs";
import * as UARulesAPI from "./ua-rules.mjs";
import { UARuleListResponsesV4PagePaginationArray, UARules, } from "./ua-rules.mjs";
import * as WAFAPI from "./waf/waf.mjs";
import { WAF } from "./waf/waf.mjs";
export class Firewall extends APIResource {
    constructor() {
        super(...arguments);
        this.lockdowns = new LockdownsAPI.Lockdowns(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.accessRules = new AccessRulesAPI.AccessRules(this._client);
        this.uaRules = new UARulesAPI.UARules(this._client);
        this.waf = new WAFAPI.WAF(this._client);
    }
}
Firewall.Lockdowns = Lockdowns;
Firewall.LockdownsV4PagePaginationArray = LockdownsV4PagePaginationArray;
Firewall.Rules = Rules;
Firewall.FirewallRulesSinglePage = FirewallRulesSinglePage;
Firewall.FirewallRulesV4PagePaginationArray = FirewallRulesV4PagePaginationArray;
Firewall.AccessRules = AccessRules;
Firewall.AccessRuleListResponsesV4PagePaginationArray = AccessRuleListResponsesV4PagePaginationArray;
Firewall.UARules = UARules;
Firewall.UARuleListResponsesV4PagePaginationArray = UARuleListResponsesV4PagePaginationArray;
Firewall.WAF = WAF;
//# sourceMappingURL=firewall.mjs.map