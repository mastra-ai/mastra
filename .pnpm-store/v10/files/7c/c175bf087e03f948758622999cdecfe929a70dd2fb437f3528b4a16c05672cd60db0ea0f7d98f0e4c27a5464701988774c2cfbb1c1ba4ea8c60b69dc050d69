// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AppTypesAPI from "./app-types.mjs";
import { AppTypes, AppTypesSinglePage } from "./app-types.mjs";
import * as AuditSSHSettingsAPI from "./audit-ssh-settings.mjs";
import { AuditSSHSettings, } from "./audit-ssh-settings.mjs";
import * as CategoriesAPI from "./categories.mjs";
import { Categories, CategoriesSinglePage } from "./categories.mjs";
import * as CertificatesAPI from "./certificates.mjs";
import { CertificateListResponsesSinglePage, Certificates, } from "./certificates.mjs";
import * as LocationsAPI from "./locations.mjs";
import { Locations, LocationsSinglePage, } from "./locations.mjs";
import * as LoggingAPI from "./logging.mjs";
import { Logging } from "./logging.mjs";
import * as ProxyEndpointsAPI from "./proxy-endpoints.mjs";
import { ProxyEndpoints, ProxyEndpointsSinglePage, } from "./proxy-endpoints.mjs";
import * as RulesAPI from "./rules.mjs";
import { GatewayRulesSinglePage, Rules, } from "./rules.mjs";
import * as ConfigurationsAPI from "./configurations/configurations.mjs";
import { Configurations, } from "./configurations/configurations.mjs";
import * as ListsAPI from "./lists/lists.mjs";
import { GatewayListsSinglePage, Lists, } from "./lists/lists.mjs";
export class Gateway extends APIResource {
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
Gateway.AuditSSHSettings = AuditSSHSettings;
Gateway.Categories = Categories;
Gateway.CategoriesSinglePage = CategoriesSinglePage;
Gateway.AppTypes = AppTypes;
Gateway.AppTypesSinglePage = AppTypesSinglePage;
Gateway.Configurations = Configurations;
Gateway.Lists = Lists;
Gateway.GatewayListsSinglePage = GatewayListsSinglePage;
Gateway.Locations = Locations;
Gateway.LocationsSinglePage = LocationsSinglePage;
Gateway.Logging = Logging;
Gateway.ProxyEndpoints = ProxyEndpoints;
Gateway.ProxyEndpointsSinglePage = ProxyEndpointsSinglePage;
Gateway.Rules = Rules;
Gateway.GatewayRulesSinglePage = GatewayRulesSinglePage;
Gateway.Certificates = Certificates;
Gateway.CertificateListResponsesSinglePage = CertificateListResponsesSinglePage;
//# sourceMappingURL=gateway.mjs.map