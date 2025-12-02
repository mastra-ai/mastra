// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ConnectivitySettingsAPI from './connectivity-settings';
import {
  ConnectivitySettingEditParams,
  ConnectivitySettingEditResponse,
  ConnectivitySettingGetParams,
  ConnectivitySettingGetResponse,
  ConnectivitySettings,
} from './connectivity-settings';
import * as SeatsAPI from './seats';
import { Seat, SeatEditParams, Seats, SeatsSinglePage } from './seats';
import * as AccessAPI from './access/access';
import { Access } from './access/access';
import * as DevicesAPI from './devices/devices';
import {
  Device,
  DeviceGetParams,
  DeviceGetResponse,
  DeviceListParams,
  Devices,
  DevicesSinglePage,
} from './devices/devices';
import * as DEXAPI from './dex/dex';
import { DEX, DigitalExperienceMonitor, NetworkPath, NetworkPathResponse, Percentiles } from './dex/dex';
import * as DLPAPI from './dlp/dlp';
import { DLP } from './dlp/dlp';
import * as GatewayAPI from './gateway/gateway';
import {
  Gateway,
  GatewayCreateParams,
  GatewayCreateResponse,
  GatewayListParams,
  GatewayListResponse,
} from './gateway/gateway';
import * as IdentityProvidersAPI from './identity-providers/identity-providers';
import {
  AzureAD,
  GenericOAuthConfig,
  IdentityProvider,
  IdentityProviderCreateParams,
  IdentityProviderDeleteParams,
  IdentityProviderDeleteResponse,
  IdentityProviderGetParams,
  IdentityProviderListParams,
  IdentityProviderListResponse,
  IdentityProviderListResponsesSinglePage,
  IdentityProviderSCIMConfig,
  IdentityProviderType,
  IdentityProviderUpdateParams,
  IdentityProviders,
} from './identity-providers/identity-providers';
import * as NetworksAPI from './networks/networks';
import { Networks } from './networks/networks';
import * as OrganizationsAPI from './organizations/organizations';
import {
  LoginDesign,
  Organization,
  OrganizationCreateParams,
  OrganizationListParams,
  OrganizationRevokeUsersParams,
  OrganizationRevokeUsersResponse,
  OrganizationUpdateParams,
  Organizations,
} from './organizations/organizations';
import * as RiskScoringAPI from './risk-scoring/risk-scoring';
import {
  RiskScoring,
  RiskScoringGetParams,
  RiskScoringGetResponse,
  RiskScoringResetParams,
  RiskScoringResetResponse,
} from './risk-scoring/risk-scoring';
import * as TunnelsAPI from './tunnels/tunnels';
import {
  Connection,
  TunnelListParams,
  TunnelListResponse,
  TunnelListResponsesV4PagePaginationArray,
  Tunnels,
} from './tunnels/tunnels';

export class ZeroTrust extends APIResource {
  devices: DevicesAPI.Devices = new DevicesAPI.Devices(this._client);
  identityProviders: IdentityProvidersAPI.IdentityProviders = new IdentityProvidersAPI.IdentityProviders(
    this._client,
  );
  organizations: OrganizationsAPI.Organizations = new OrganizationsAPI.Organizations(this._client);
  seats: SeatsAPI.Seats = new SeatsAPI.Seats(this._client);
  access: AccessAPI.Access = new AccessAPI.Access(this._client);
  dex: DEXAPI.DEX = new DEXAPI.DEX(this._client);
  tunnels: TunnelsAPI.Tunnels = new TunnelsAPI.Tunnels(this._client);
  connectivitySettings: ConnectivitySettingsAPI.ConnectivitySettings =
    new ConnectivitySettingsAPI.ConnectivitySettings(this._client);
  dlp: DLPAPI.DLP = new DLPAPI.DLP(this._client);
  gateway: GatewayAPI.Gateway = new GatewayAPI.Gateway(this._client);
  networks: NetworksAPI.Networks = new NetworksAPI.Networks(this._client);
  riskScoring: RiskScoringAPI.RiskScoring = new RiskScoringAPI.RiskScoring(this._client);
}

ZeroTrust.Devices = Devices;
ZeroTrust.DevicesSinglePage = DevicesSinglePage;
ZeroTrust.IdentityProviders = IdentityProviders;
ZeroTrust.IdentityProviderListResponsesSinglePage = IdentityProviderListResponsesSinglePage;
ZeroTrust.Organizations = Organizations;
ZeroTrust.Seats = Seats;
ZeroTrust.SeatsSinglePage = SeatsSinglePage;
ZeroTrust.Access = Access;
ZeroTrust.DEX = DEX;
ZeroTrust.Tunnels = Tunnels;
ZeroTrust.TunnelListResponsesV4PagePaginationArray = TunnelListResponsesV4PagePaginationArray;
ZeroTrust.ConnectivitySettings = ConnectivitySettings;
ZeroTrust.DLP = DLP;
ZeroTrust.Gateway = Gateway;
ZeroTrust.Networks = Networks;
ZeroTrust.RiskScoring = RiskScoring;

export declare namespace ZeroTrust {
  export {
    Devices as Devices,
    type Device as Device,
    type DeviceGetResponse as DeviceGetResponse,
    DevicesSinglePage as DevicesSinglePage,
    type DeviceListParams as DeviceListParams,
    type DeviceGetParams as DeviceGetParams,
  };

  export {
    IdentityProviders as IdentityProviders,
    type AzureAD as AzureAD,
    type GenericOAuthConfig as GenericOAuthConfig,
    type IdentityProvider as IdentityProvider,
    type IdentityProviderSCIMConfig as IdentityProviderSCIMConfig,
    type IdentityProviderType as IdentityProviderType,
    type IdentityProviderListResponse as IdentityProviderListResponse,
    type IdentityProviderDeleteResponse as IdentityProviderDeleteResponse,
    IdentityProviderListResponsesSinglePage as IdentityProviderListResponsesSinglePage,
    type IdentityProviderCreateParams as IdentityProviderCreateParams,
    type IdentityProviderUpdateParams as IdentityProviderUpdateParams,
    type IdentityProviderListParams as IdentityProviderListParams,
    type IdentityProviderDeleteParams as IdentityProviderDeleteParams,
    type IdentityProviderGetParams as IdentityProviderGetParams,
  };

  export {
    Organizations as Organizations,
    type LoginDesign as LoginDesign,
    type Organization as Organization,
    type OrganizationRevokeUsersResponse as OrganizationRevokeUsersResponse,
    type OrganizationCreateParams as OrganizationCreateParams,
    type OrganizationUpdateParams as OrganizationUpdateParams,
    type OrganizationListParams as OrganizationListParams,
    type OrganizationRevokeUsersParams as OrganizationRevokeUsersParams,
  };

  export {
    Seats as Seats,
    type Seat as Seat,
    SeatsSinglePage as SeatsSinglePage,
    type SeatEditParams as SeatEditParams,
  };

  export { Access as Access };

  export {
    DEX as DEX,
    type DigitalExperienceMonitor as DigitalExperienceMonitor,
    type NetworkPath as NetworkPath,
    type NetworkPathResponse as NetworkPathResponse,
    type Percentiles as Percentiles,
  };

  export {
    Tunnels as Tunnels,
    type Connection as Connection,
    type TunnelListResponse as TunnelListResponse,
    TunnelListResponsesV4PagePaginationArray as TunnelListResponsesV4PagePaginationArray,
    type TunnelListParams as TunnelListParams,
  };

  export {
    ConnectivitySettings as ConnectivitySettings,
    type ConnectivitySettingEditResponse as ConnectivitySettingEditResponse,
    type ConnectivitySettingGetResponse as ConnectivitySettingGetResponse,
    type ConnectivitySettingEditParams as ConnectivitySettingEditParams,
    type ConnectivitySettingGetParams as ConnectivitySettingGetParams,
  };

  export { DLP as DLP };

  export {
    Gateway as Gateway,
    type GatewayCreateResponse as GatewayCreateResponse,
    type GatewayListResponse as GatewayListResponse,
    type GatewayCreateParams as GatewayCreateParams,
    type GatewayListParams as GatewayListParams,
  };

  export { Networks as Networks };

  export {
    RiskScoring as RiskScoring,
    type RiskScoringGetResponse as RiskScoringGetResponse,
    type RiskScoringResetResponse as RiskScoringResetResponse,
    type RiskScoringGetParams as RiskScoringGetParams,
    type RiskScoringResetParams as RiskScoringResetParams,
  };
}
