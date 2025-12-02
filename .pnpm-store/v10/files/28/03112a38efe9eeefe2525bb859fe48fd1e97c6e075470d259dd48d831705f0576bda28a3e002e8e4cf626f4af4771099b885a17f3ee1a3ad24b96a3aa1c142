// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AccountSettingsAPI from "./account-settings.mjs";
import { AccountSettings, } from "./account-settings.mjs";
import * as DomainsAPI from "./domains.mjs";
import { Domains, DomainsSinglePage, } from "./domains.mjs";
import * as RoutesAPI from "./routes.mjs";
import { RouteListResponsesSinglePage, Routes, } from "./routes.mjs";
import * as SubdomainsAPI from "./subdomains.mjs";
import { Subdomains, } from "./subdomains.mjs";
import * as AssetsAPI from "./assets/assets.mjs";
import { Assets } from "./assets/assets.mjs";
import * as ObservabilityAPI from "./observability/observability.mjs";
import { Observability } from "./observability/observability.mjs";
import * as ScriptsAPI from "./scripts/scripts.mjs";
import { Scripts, ScriptsSinglePage, } from "./scripts/scripts.mjs";
export class Workers extends APIResource {
    constructor() {
        super(...arguments);
        this.routes = new RoutesAPI.Routes(this._client);
        this.assets = new AssetsAPI.Assets(this._client);
        this.scripts = new ScriptsAPI.Scripts(this._client);
        this.accountSettings = new AccountSettingsAPI.AccountSettings(this._client);
        this.domains = new DomainsAPI.Domains(this._client);
        this.subdomains = new SubdomainsAPI.Subdomains(this._client);
        this.observability = new ObservabilityAPI.Observability(this._client);
    }
}
Workers.Routes = Routes;
Workers.RouteListResponsesSinglePage = RouteListResponsesSinglePage;
Workers.Assets = Assets;
Workers.Scripts = Scripts;
Workers.ScriptsSinglePage = ScriptsSinglePage;
Workers.AccountSettings = AccountSettings;
Workers.Domains = Domains;
Workers.DomainsSinglePage = DomainsSinglePage;
Workers.Subdomains = Subdomains;
Workers.Observability = Observability;
//# sourceMappingURL=workers.mjs.map