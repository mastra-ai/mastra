// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as AppTypesAPI from './app-types';
import { AppType, AppTypeListParams, AppTypes, AppTypesSinglePage } from './app-types';
import * as AuditSSHSettingsAPI from './audit-ssh-settings';
import {
  AuditSSHSettingGetParams,
  AuditSSHSettingRotateSeedParams,
  AuditSSHSettingUpdateParams,
  AuditSSHSettings,
  GatewaySettings,
} from './audit-ssh-settings';
import * as CategoriesAPI from './categories';
import { Categories, CategoriesSinglePage, Category, CategoryListParams } from './categories';
import * as CertificatesAPI from './certificates';
import {
  CertificateActivateParams,
  CertificateActivateResponse,
  CertificateCreateParams,
  CertificateCreateResponse,
  CertificateDeactivateParams,
  CertificateDeactivateResponse,
  CertificateDeleteParams,
  CertificateDeleteResponse,
  CertificateGetParams,
  CertificateGetResponse,
  CertificateListParams,
  CertificateListResponse,
  CertificateListResponsesSinglePage,
  Certificates,
} from './certificates';
import * as LocationsAPI from './locations';
import {
  DOHEndpoint,
  DOTEndpoint,
  Endpoint,
  IPNetwork,
  IPV4Endpoint,
  IPV6Endpoint,
  IPV6Network,
  Location,
  LocationCreateParams,
  LocationDeleteParams,
  LocationDeleteResponse,
  LocationGetParams,
  LocationListParams,
  LocationUpdateParams,
  Locations,
  LocationsSinglePage,
} from './locations';
import * as LoggingAPI from './logging';
import { Logging, LoggingGetParams, LoggingSetting, LoggingUpdateParams } from './logging';
import * as ProxyEndpointsAPI from './proxy-endpoints';
import {
  GatewayIPs,
  ProxyEndpoint,
  ProxyEndpointCreateParams,
  ProxyEndpointDeleteParams,
  ProxyEndpointDeleteResponse,
  ProxyEndpointEditParams,
  ProxyEndpointGetParams,
  ProxyEndpointListParams,
  ProxyEndpoints,
  ProxyEndpointsSinglePage,
} from './proxy-endpoints';
import * as RulesAPI from './rules';
import {
  DNSResolverSettingsV4,
  DNSResolverSettingsV6,
  GatewayFilter,
  GatewayRule,
  GatewayRulesSinglePage,
  RuleCreateParams,
  RuleDeleteParams,
  RuleDeleteResponse,
  RuleGetParams,
  RuleListParams,
  RuleResetExpirationParams,
  RuleSetting,
  RuleUpdateParams,
  Rules,
  Schedule,
} from './rules';
import * as ConfigurationsAPI from './configurations/configurations';
import {
  ActivityLogSettings,
  AntiVirusSettings,
  BlockPageSettings,
  BodyScanningSettings,
  BrowserIsolationSettings,
  ConfigurationEditParams,
  ConfigurationEditResponse,
  ConfigurationGetParams,
  ConfigurationGetResponse,
  ConfigurationUpdateParams,
  ConfigurationUpdateResponse,
  Configurations,
  CustomCertificateSettings,
  ExtendedEmailMatching,
  FipsSettings,
  GatewayConfigurationSettings,
  NotificationSettings,
  ProtocolDetection,
  TLSSettings,
} from './configurations/configurations';
import * as ListsAPI from './lists/lists';
import {
  GatewayItem,
  GatewayList,
  GatewayListsSinglePage,
  ListCreateParams,
  ListCreateResponse,
  ListDeleteParams,
  ListDeleteResponse,
  ListEditParams,
  ListGetParams,
  ListListParams,
  ListUpdateParams,
  Lists,
} from './lists/lists';

export class Gateway extends APIResource {
  auditSSHSettings: AuditSSHSettingsAPI.AuditSSHSettings = new AuditSSHSettingsAPI.AuditSSHSettings(
    this._client,
  );
  categories: CategoriesAPI.Categories = new CategoriesAPI.Categories(this._client);
  appTypes: AppTypesAPI.AppTypes = new AppTypesAPI.AppTypes(this._client);
  configurations: ConfigurationsAPI.Configurations = new ConfigurationsAPI.Configurations(this._client);
  lists: ListsAPI.Lists = new ListsAPI.Lists(this._client);
  locations: LocationsAPI.Locations = new LocationsAPI.Locations(this._client);
  logging: LoggingAPI.Logging = new LoggingAPI.Logging(this._client);
  proxyEndpoints: ProxyEndpointsAPI.ProxyEndpoints = new ProxyEndpointsAPI.ProxyEndpoints(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
  certificates: CertificatesAPI.Certificates = new CertificatesAPI.Certificates(this._client);

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
  create(params: GatewayCreateParams, options?: Core.RequestOptions): Core.APIPromise<GatewayCreateResponse> {
    const { account_id } = params;
    return (
      this._client.post(`/accounts/${account_id}/gateway`, options) as Core.APIPromise<{
        result: GatewayCreateResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
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
  list(params: GatewayListParams, options?: Core.RequestOptions): Core.APIPromise<GatewayListResponse> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/gateway`, options) as Core.APIPromise<{
        result: GatewayListResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface GatewayCreateResponse {
  /**
   * Cloudflare account ID.
   */
  id?: string;

  /**
   * Gateway internal ID.
   */
  gateway_tag?: string;

  /**
   * The name of the provider. Usually Cloudflare.
   */
  provider_name?: string;
}

export interface GatewayListResponse {
  /**
   * Cloudflare account ID.
   */
  id?: string;

  /**
   * Gateway internal ID.
   */
  gateway_tag?: string;

  /**
   * The name of the provider. Usually Cloudflare.
   */
  provider_name?: string;
}

export interface GatewayCreateParams {
  account_id: string;
}

export interface GatewayListParams {
  account_id: string;
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

export declare namespace Gateway {
  export {
    type GatewayCreateResponse as GatewayCreateResponse,
    type GatewayListResponse as GatewayListResponse,
    type GatewayCreateParams as GatewayCreateParams,
    type GatewayListParams as GatewayListParams,
  };

  export {
    AuditSSHSettings as AuditSSHSettings,
    type GatewaySettings as GatewaySettings,
    type AuditSSHSettingUpdateParams as AuditSSHSettingUpdateParams,
    type AuditSSHSettingGetParams as AuditSSHSettingGetParams,
    type AuditSSHSettingRotateSeedParams as AuditSSHSettingRotateSeedParams,
  };

  export {
    Categories as Categories,
    type Category as Category,
    CategoriesSinglePage as CategoriesSinglePage,
    type CategoryListParams as CategoryListParams,
  };

  export {
    AppTypes as AppTypes,
    type AppType as AppType,
    AppTypesSinglePage as AppTypesSinglePage,
    type AppTypeListParams as AppTypeListParams,
  };

  export {
    Configurations as Configurations,
    type ActivityLogSettings as ActivityLogSettings,
    type AntiVirusSettings as AntiVirusSettings,
    type BlockPageSettings as BlockPageSettings,
    type BodyScanningSettings as BodyScanningSettings,
    type BrowserIsolationSettings as BrowserIsolationSettings,
    type CustomCertificateSettings as CustomCertificateSettings,
    type ExtendedEmailMatching as ExtendedEmailMatching,
    type FipsSettings as FipsSettings,
    type GatewayConfigurationSettings as GatewayConfigurationSettings,
    type NotificationSettings as NotificationSettings,
    type ProtocolDetection as ProtocolDetection,
    type TLSSettings as TLSSettings,
    type ConfigurationUpdateResponse as ConfigurationUpdateResponse,
    type ConfigurationEditResponse as ConfigurationEditResponse,
    type ConfigurationGetResponse as ConfigurationGetResponse,
    type ConfigurationUpdateParams as ConfigurationUpdateParams,
    type ConfigurationEditParams as ConfigurationEditParams,
    type ConfigurationGetParams as ConfigurationGetParams,
  };

  export {
    Lists as Lists,
    type GatewayItem as GatewayItem,
    type GatewayList as GatewayList,
    type ListCreateResponse as ListCreateResponse,
    type ListDeleteResponse as ListDeleteResponse,
    GatewayListsSinglePage as GatewayListsSinglePage,
    type ListCreateParams as ListCreateParams,
    type ListUpdateParams as ListUpdateParams,
    type ListListParams as ListListParams,
    type ListDeleteParams as ListDeleteParams,
    type ListEditParams as ListEditParams,
    type ListGetParams as ListGetParams,
  };

  export {
    Locations as Locations,
    type DOHEndpoint as DOHEndpoint,
    type DOTEndpoint as DOTEndpoint,
    type Endpoint as Endpoint,
    type IPNetwork as IPNetwork,
    type IPV4Endpoint as IPV4Endpoint,
    type IPV6Endpoint as IPV6Endpoint,
    type IPV6Network as IPV6Network,
    type Location as Location,
    type LocationDeleteResponse as LocationDeleteResponse,
    LocationsSinglePage as LocationsSinglePage,
    type LocationCreateParams as LocationCreateParams,
    type LocationUpdateParams as LocationUpdateParams,
    type LocationListParams as LocationListParams,
    type LocationDeleteParams as LocationDeleteParams,
    type LocationGetParams as LocationGetParams,
  };

  export {
    Logging as Logging,
    type LoggingSetting as LoggingSetting,
    type LoggingUpdateParams as LoggingUpdateParams,
    type LoggingGetParams as LoggingGetParams,
  };

  export {
    ProxyEndpoints as ProxyEndpoints,
    type GatewayIPs as GatewayIPs,
    type ProxyEndpoint as ProxyEndpoint,
    type ProxyEndpointDeleteResponse as ProxyEndpointDeleteResponse,
    ProxyEndpointsSinglePage as ProxyEndpointsSinglePage,
    type ProxyEndpointCreateParams as ProxyEndpointCreateParams,
    type ProxyEndpointListParams as ProxyEndpointListParams,
    type ProxyEndpointDeleteParams as ProxyEndpointDeleteParams,
    type ProxyEndpointEditParams as ProxyEndpointEditParams,
    type ProxyEndpointGetParams as ProxyEndpointGetParams,
  };

  export {
    Rules as Rules,
    type DNSResolverSettingsV4 as DNSResolverSettingsV4,
    type DNSResolverSettingsV6 as DNSResolverSettingsV6,
    type GatewayFilter as GatewayFilter,
    type GatewayRule as GatewayRule,
    type RuleSetting as RuleSetting,
    type Schedule as Schedule,
    type RuleDeleteResponse as RuleDeleteResponse,
    GatewayRulesSinglePage as GatewayRulesSinglePage,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleGetParams as RuleGetParams,
    type RuleResetExpirationParams as RuleResetExpirationParams,
  };

  export {
    Certificates as Certificates,
    type CertificateCreateResponse as CertificateCreateResponse,
    type CertificateListResponse as CertificateListResponse,
    type CertificateDeleteResponse as CertificateDeleteResponse,
    type CertificateActivateResponse as CertificateActivateResponse,
    type CertificateDeactivateResponse as CertificateDeactivateResponse,
    type CertificateGetResponse as CertificateGetResponse,
    CertificateListResponsesSinglePage as CertificateListResponsesSinglePage,
    type CertificateCreateParams as CertificateCreateParams,
    type CertificateListParams as CertificateListParams,
    type CertificateDeleteParams as CertificateDeleteParams,
    type CertificateActivateParams as CertificateActivateParams,
    type CertificateDeactivateParams as CertificateDeactivateParams,
    type CertificateGetParams as CertificateGetParams,
  };
}
