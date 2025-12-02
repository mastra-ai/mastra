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
exports.Workers = void 0;
const resource_1 = require("../../resource.js");
const AccountSettingsAPI = __importStar(require("./account-settings.js"));
const account_settings_1 = require("./account-settings.js");
const DomainsAPI = __importStar(require("./domains.js"));
const domains_1 = require("./domains.js");
const RoutesAPI = __importStar(require("./routes.js"));
const routes_1 = require("./routes.js");
const SubdomainsAPI = __importStar(require("./subdomains.js"));
const subdomains_1 = require("./subdomains.js");
const AssetsAPI = __importStar(require("./assets/assets.js"));
const assets_1 = require("./assets/assets.js");
const ObservabilityAPI = __importStar(require("./observability/observability.js"));
const observability_1 = require("./observability/observability.js");
const ScriptsAPI = __importStar(require("./scripts/scripts.js"));
const scripts_1 = require("./scripts/scripts.js");
class Workers extends resource_1.APIResource {
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
exports.Workers = Workers;
Workers.Routes = routes_1.Routes;
Workers.RouteListResponsesSinglePage = routes_1.RouteListResponsesSinglePage;
Workers.Assets = assets_1.Assets;
Workers.Scripts = scripts_1.Scripts;
Workers.ScriptsSinglePage = scripts_1.ScriptsSinglePage;
Workers.AccountSettings = account_settings_1.AccountSettings;
Workers.Domains = domains_1.Domains;
Workers.DomainsSinglePage = domains_1.DomainsSinglePage;
Workers.Subdomains = subdomains_1.Subdomains;
Workers.Observability = observability_1.Observability;
//# sourceMappingURL=workers.js.map