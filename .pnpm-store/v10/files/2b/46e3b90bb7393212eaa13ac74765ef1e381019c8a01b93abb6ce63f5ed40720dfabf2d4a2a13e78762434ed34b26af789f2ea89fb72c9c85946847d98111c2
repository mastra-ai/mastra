// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as CustomAPI from "./custom/custom.mjs";
import { Custom, } from "./custom/custom.mjs";
import * as DefaultAPI from "./default/default.mjs";
import { Default, } from "./default/default.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Policies extends APIResource {
    constructor() {
        super(...arguments);
        this.default = new DefaultAPI.Default(this._client);
        this.custom = new CustomAPI.Custom(this._client);
    }
}
export class SplitTunnelExcludesSinglePage extends SinglePage {
}
export class SplitTunnelIncludesSinglePage extends SinglePage {
}
export class FallbackDomainsSinglePage extends SinglePage {
}
export class SettingsPoliciesSinglePage extends SinglePage {
}
Policies.Default = Default;
Policies.Custom = Custom;
//# sourceMappingURL=policies.mjs.map