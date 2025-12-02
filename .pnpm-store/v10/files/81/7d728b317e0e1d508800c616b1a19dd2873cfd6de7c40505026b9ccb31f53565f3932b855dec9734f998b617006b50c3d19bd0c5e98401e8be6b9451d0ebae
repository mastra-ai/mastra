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
exports.Gateway = void 0;
const resource_1 = require("../../../resource.js");
const AppTypesAPI = __importStar(require("./app-types.js"));
const app_types_1 = require("./app-types.js");
const AuditSSHSettingsAPI = __importStar(require("./audit-ssh-settings.js"));
const audit_ssh_settings_1 = require("./audit-ssh-settings.js");
const CategoriesAPI = __importStar(require("./categories.js"));
const categories_1 = require("./categories.js");
const CertificatesAPI = __importStar(require("./certificates.js"));
const certificates_1 = require("./certificates.js");
const LocationsAPI = __importStar(require("./locations.js"));
const locations_1 = require("./locations.js");
const LoggingAPI = __importStar(require("./logging.js"));
const logging_1 = require("./logging.js");
const ProxyEndpointsAPI = __importStar(require("./proxy-endpoints.js"));
const proxy_endpoints_1 = require("./proxy-endpoints.js");
const RulesAPI = __importStar(require("./rules.js"));
const rules_1 = require("./rules.js");
const ConfigurationsAPI = __importStar(require("./configurations/configurations.js"));
const configurations_1 = require("./configurations/configurations.js");
const ListsAPI = __importStar(require("./lists/lists.js"));
const lists_1 = require("./lists/lists.js");
class Gateway extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.auditSSHSettings = new AuditSSHSettingsAPI.AuditSSHSettings(this._client);
        this.categories = new CategoriesAPI.Categories(this._client);
        this.appTypes = new AppTypesAPI.AppTypes(this._client);
        this.configurations = new ConfigurationsAPI.Configurations(this._client);
        this.lists = new ListsAPI.Lists(this._client);
        this.locations = new LocationsAPI.Locations(this._client);
        this.logging = new LoggingAPI.Logging(this._client);
        this.proxyEndpoints = new ProxyEndpointsAPI.ProxyEndpoints(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.certificates = new CertificatesAPI.Certificates(this._client);
    }
    /**
     * Creates a Zero Trust account with an existing Cloudflare account.
     *
     * @example
     * ```ts
     * const gateway = await client.zeroTrust.gateway.create({
     *   account_id: '699d98642c564d2e855e9661899b7252',
     * });
     * ```
     */
    create(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/gateway`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets information about the current Zero Trust account.
     *
     * @example
     * ```ts
     * const gateways = await client.zeroTrust.gateway.list({
     *   account_id: '699d98642c564d2e855e9661899b7252',
     * });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Gateway = Gateway;
Gateway.AuditSSHSettings = audit_ssh_settings_1.AuditSSHSettings;
Gateway.Categories = categories_1.Categories;
Gateway.CategoriesSinglePage = categories_1.CategoriesSinglePage;
Gateway.AppTypes = app_types_1.AppTypes;
Gateway.AppTypesSinglePage = app_types_1.AppTypesSinglePage;
Gateway.Configurations = configurations_1.Configurations;
Gateway.Lists = lists_1.Lists;
Gateway.GatewayListsSinglePage = lists_1.GatewayListsSinglePage;
Gateway.Locations = locations_1.Locations;
Gateway.LocationsSinglePage = locations_1.LocationsSinglePage;
Gateway.Logging = logging_1.Logging;
Gateway.ProxyEndpoints = proxy_endpoints_1.ProxyEndpoints;
Gateway.ProxyEndpointsSinglePage = proxy_endpoints_1.ProxyEndpointsSinglePage;
Gateway.Rules = rules_1.Rules;
Gateway.GatewayRulesSinglePage = rules_1.GatewayRulesSinglePage;
Gateway.Certificates = certificates_1.Certificates;
Gateway.CertificateListResponsesSinglePage = certificates_1.CertificateListResponsesSinglePage;
//# sourceMappingURL=gateway.js.map