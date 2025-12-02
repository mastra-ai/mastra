// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as OverridesAPI from "./overrides.mjs";
import { Overrides, OverridesV4PagePaginationArray, } from "./overrides.mjs";
import * as PackagesAPI from "./packages/packages.mjs";
import { PackageListResponsesV4PagePaginationArray, Packages, } from "./packages/packages.mjs";
/**
 * @deprecated WAF managed rules API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#waf-managed-rules-apis-previous-version for full details.
 */
export class WAF extends APIResource {
    constructor() {
        super(...arguments);
        this.overrides = new OverridesAPI.Overrides(this._client);
        this.packages = new PackagesAPI.Packages(this._client);
    }
}
WAF.Overrides = Overrides;
WAF.OverridesV4PagePaginationArray = OverridesV4PagePaginationArray;
WAF.Packages = Packages;
WAF.PackageListResponsesV4PagePaginationArray = PackageListResponsesV4PagePaginationArray;
//# sourceMappingURL=waf.mjs.map