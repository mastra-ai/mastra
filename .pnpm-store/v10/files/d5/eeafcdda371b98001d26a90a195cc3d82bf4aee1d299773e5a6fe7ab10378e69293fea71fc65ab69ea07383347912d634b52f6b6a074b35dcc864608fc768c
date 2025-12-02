// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as AppsAPI from './apps';
import {
  AppCreateParams,
  AppCreateResponse,
  AppDeleteParams,
  AppDeleteResponse,
  AppEditParams,
  AppEditResponse,
  AppListParams,
  AppListResponse,
  AppListResponsesSinglePage,
  AppUpdateParams,
  AppUpdateResponse,
  Apps,
} from './apps';
import * as CfInterconnectsAPI from './cf-interconnects';
import {
  CfInterconnectBulkUpdateParams,
  CfInterconnectBulkUpdateResponse,
  CfInterconnectGetParams,
  CfInterconnectGetResponse,
  CfInterconnectListParams,
  CfInterconnectListResponse,
  CfInterconnectUpdateParams,
  CfInterconnectUpdateResponse,
  CfInterconnects,
} from './cf-interconnects';
import * as GRETunnelsAPI from './gre-tunnels';
import {
  GRETunnelBulkUpdateParams,
  GRETunnelBulkUpdateResponse,
  GRETunnelCreateParams,
  GRETunnelCreateResponse,
  GRETunnelDeleteParams,
  GRETunnelDeleteResponse,
  GRETunnelGetParams,
  GRETunnelGetResponse,
  GRETunnelListParams,
  GRETunnelListResponse,
  GRETunnelUpdateParams,
  GRETunnelUpdateResponse,
  GRETunnels,
} from './gre-tunnels';
import * as IPSECTunnelsAPI from './ipsec-tunnels';
import {
  IPSECTunnelBulkUpdateParams,
  IPSECTunnelBulkUpdateResponse,
  IPSECTunnelCreateParams,
  IPSECTunnelCreateResponse,
  IPSECTunnelDeleteParams,
  IPSECTunnelDeleteResponse,
  IPSECTunnelGetParams,
  IPSECTunnelGetResponse,
  IPSECTunnelListParams,
  IPSECTunnelListResponse,
  IPSECTunnelPSKGenerateParams,
  IPSECTunnelPSKGenerateResponse,
  IPSECTunnelUpdateParams,
  IPSECTunnelUpdateResponse,
  IPSECTunnels,
  PSKMetadata,
} from './ipsec-tunnels';
import * as RoutesAPI from './routes';
import {
  RouteBulkUpdateParams,
  RouteBulkUpdateResponse,
  RouteCreateParams,
  RouteCreateResponse,
  RouteDeleteParams,
  RouteDeleteResponse,
  RouteEmptyParams,
  RouteEmptyResponse,
  RouteGetParams,
  RouteGetResponse,
  RouteListParams,
  RouteListResponse,
  RouteUpdateParams,
  RouteUpdateResponse,
  Routes,
  Scope,
} from './routes';
import * as ConnectorsAPI from './connectors/connectors';
import {
  ConnectorCreateParams,
  ConnectorCreateResponse,
  ConnectorDeleteParams,
  ConnectorDeleteResponse,
  ConnectorEditParams,
  ConnectorEditResponse,
  ConnectorGetParams,
  ConnectorGetResponse,
  ConnectorListParams,
  ConnectorListResponse,
  ConnectorListResponsesSinglePage,
  ConnectorUpdateParams,
  ConnectorUpdateResponse,
  Connectors,
} from './connectors/connectors';
import * as PCAPsAPI from './pcaps/pcaps';
import {
  PCAP,
  PCAPCreateParams,
  PCAPCreateResponse,
  PCAPFilter,
  PCAPGetParams,
  PCAPGetResponse,
  PCAPListParams,
  PCAPListResponse,
  PCAPListResponsesSinglePage,
  PCAPStopParams,
  PCAPs,
} from './pcaps/pcaps';
import * as SitesAPI from './sites/sites';
import {
  Site,
  SiteCreateParams,
  SiteDeleteParams,
  SiteEditParams,
  SiteGetParams,
  SiteListParams,
  SiteLocation,
  SiteUpdateParams,
  Sites,
  SitesSinglePage,
} from './sites/sites';

export class MagicTransit extends APIResource {
  apps: AppsAPI.Apps = new AppsAPI.Apps(this._client);
  cfInterconnects: CfInterconnectsAPI.CfInterconnects = new CfInterconnectsAPI.CfInterconnects(this._client);
  greTunnels: GRETunnelsAPI.GRETunnels = new GRETunnelsAPI.GRETunnels(this._client);
  ipsecTunnels: IPSECTunnelsAPI.IPSECTunnels = new IPSECTunnelsAPI.IPSECTunnels(this._client);
  routes: RoutesAPI.Routes = new RoutesAPI.Routes(this._client);
  sites: SitesAPI.Sites = new SitesAPI.Sites(this._client);
  connectors: ConnectorsAPI.Connectors = new ConnectorsAPI.Connectors(this._client);
  pcaps: PCAPsAPI.PCAPs = new PCAPsAPI.PCAPs(this._client);
}

export interface HealthCheck {
  /**
   * Determines whether to run healthchecks for a tunnel.
   */
  enabled?: boolean;

  /**
   * How frequent the health check is run. The default value is `mid`.
   */
  rate?: HealthCheckRate;

  /**
   * The destination address in a request type health check. After the healthcheck is
   * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
   * to this address. This field defaults to `customer_gre_endpoint address`. This
   * field is ignored for bidirectional healthchecks as the interface_address (not
   * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
   * object form if the x-magic-new-hc-target header is set to true and string form
   * if x-magic-new-hc-target is absent or set to false.
   */
  target?: HealthCheck.MagicHealthCheckTarget | string;

  /**
   * The type of healthcheck to run, reply or request. The default value is `reply`.
   */
  type?: HealthCheckType;
}

export namespace HealthCheck {
  /**
   * The destination address in a request type health check. After the healthcheck is
   * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
   * to this address. This field defaults to `customer_gre_endpoint address`. This
   * field is ignored for bidirectional healthchecks as the interface_address (not
   * assigned to the Cloudflare side of the tunnel) is used as the target.
   */
  export interface MagicHealthCheckTarget {
    /**
     * The effective health check target. If 'saved' is empty, then this field will be
     * populated with the calculated default value on GET requests. Ignored in POST,
     * PUT, and PATCH requests.
     */
    effective?: string;

    /**
     * The saved health check target. Setting the value to the empty string indicates
     * that the calculated default value will be used.
     */
    saved?: string;
  }
}

export interface HealthCheckParam {
  /**
   * Determines whether to run healthchecks for a tunnel.
   */
  enabled?: boolean;

  /**
   * How frequent the health check is run. The default value is `mid`.
   */
  rate?: HealthCheckRateParam;

  /**
   * The destination address in a request type health check. After the healthcheck is
   * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
   * to this address. This field defaults to `customer_gre_endpoint address`. This
   * field is ignored for bidirectional healthchecks as the interface_address (not
   * assigned to the Cloudflare side of the tunnel) is used as the target. Must be in
   * object form if the x-magic-new-hc-target header is set to true and string form
   * if x-magic-new-hc-target is absent or set to false.
   */
  target?: HealthCheckParam.MagicHealthCheckTarget | string;

  /**
   * The type of healthcheck to run, reply or request. The default value is `reply`.
   */
  type?: HealthCheckTypeParam;
}

export namespace HealthCheckParam {
  /**
   * The destination address in a request type health check. After the healthcheck is
   * decapsulated at the customer end of the tunnel, the ICMP echo will be forwarded
   * to this address. This field defaults to `customer_gre_endpoint address`. This
   * field is ignored for bidirectional healthchecks as the interface_address (not
   * assigned to the Cloudflare side of the tunnel) is used as the target.
   */
  export interface MagicHealthCheckTarget {
    /**
     * The saved health check target. Setting the value to the empty string indicates
     * that the calculated default value will be used.
     */
    saved?: string;
  }
}

/**
 * How frequent the health check is run. The default value is `mid`.
 */
export type HealthCheckRate = 'low' | 'mid' | 'high';

/**
 * How frequent the health check is run. The default value is `mid`.
 */
export type HealthCheckRateParam = 'low' | 'mid' | 'high';

/**
 * The type of healthcheck to run, reply or request. The default value is `reply`.
 */
export type HealthCheckType = 'reply' | 'request';

/**
 * The type of healthcheck to run, reply or request. The default value is `reply`.
 */
export type HealthCheckTypeParam = 'reply' | 'request';

MagicTransit.Apps = Apps;
MagicTransit.AppListResponsesSinglePage = AppListResponsesSinglePage;
MagicTransit.CfInterconnects = CfInterconnects;
MagicTransit.GRETunnels = GRETunnels;
MagicTransit.IPSECTunnels = IPSECTunnels;
MagicTransit.Routes = Routes;
MagicTransit.Sites = Sites;
MagicTransit.SitesSinglePage = SitesSinglePage;
MagicTransit.Connectors = Connectors;
MagicTransit.ConnectorListResponsesSinglePage = ConnectorListResponsesSinglePage;
MagicTransit.PCAPs = PCAPs;
MagicTransit.PCAPListResponsesSinglePage = PCAPListResponsesSinglePage;

export declare namespace MagicTransit {
  export {
    type HealthCheck as HealthCheck,
    type HealthCheckRate as HealthCheckRate,
    type HealthCheckType as HealthCheckType,
  };

  export {
    Apps as Apps,
    type AppCreateResponse as AppCreateResponse,
    type AppUpdateResponse as AppUpdateResponse,
    type AppListResponse as AppListResponse,
    type AppDeleteResponse as AppDeleteResponse,
    type AppEditResponse as AppEditResponse,
    AppListResponsesSinglePage as AppListResponsesSinglePage,
    type AppCreateParams as AppCreateParams,
    type AppUpdateParams as AppUpdateParams,
    type AppListParams as AppListParams,
    type AppDeleteParams as AppDeleteParams,
    type AppEditParams as AppEditParams,
  };

  export {
    CfInterconnects as CfInterconnects,
    type CfInterconnectUpdateResponse as CfInterconnectUpdateResponse,
    type CfInterconnectListResponse as CfInterconnectListResponse,
    type CfInterconnectBulkUpdateResponse as CfInterconnectBulkUpdateResponse,
    type CfInterconnectGetResponse as CfInterconnectGetResponse,
    type CfInterconnectUpdateParams as CfInterconnectUpdateParams,
    type CfInterconnectListParams as CfInterconnectListParams,
    type CfInterconnectBulkUpdateParams as CfInterconnectBulkUpdateParams,
    type CfInterconnectGetParams as CfInterconnectGetParams,
  };

  export {
    GRETunnels as GRETunnels,
    type GRETunnelCreateResponse as GRETunnelCreateResponse,
    type GRETunnelUpdateResponse as GRETunnelUpdateResponse,
    type GRETunnelListResponse as GRETunnelListResponse,
    type GRETunnelDeleteResponse as GRETunnelDeleteResponse,
    type GRETunnelBulkUpdateResponse as GRETunnelBulkUpdateResponse,
    type GRETunnelGetResponse as GRETunnelGetResponse,
    type GRETunnelCreateParams as GRETunnelCreateParams,
    type GRETunnelUpdateParams as GRETunnelUpdateParams,
    type GRETunnelListParams as GRETunnelListParams,
    type GRETunnelDeleteParams as GRETunnelDeleteParams,
    type GRETunnelBulkUpdateParams as GRETunnelBulkUpdateParams,
    type GRETunnelGetParams as GRETunnelGetParams,
  };

  export {
    IPSECTunnels as IPSECTunnels,
    type PSKMetadata as PSKMetadata,
    type IPSECTunnelCreateResponse as IPSECTunnelCreateResponse,
    type IPSECTunnelUpdateResponse as IPSECTunnelUpdateResponse,
    type IPSECTunnelListResponse as IPSECTunnelListResponse,
    type IPSECTunnelDeleteResponse as IPSECTunnelDeleteResponse,
    type IPSECTunnelBulkUpdateResponse as IPSECTunnelBulkUpdateResponse,
    type IPSECTunnelGetResponse as IPSECTunnelGetResponse,
    type IPSECTunnelPSKGenerateResponse as IPSECTunnelPSKGenerateResponse,
    type IPSECTunnelCreateParams as IPSECTunnelCreateParams,
    type IPSECTunnelUpdateParams as IPSECTunnelUpdateParams,
    type IPSECTunnelListParams as IPSECTunnelListParams,
    type IPSECTunnelDeleteParams as IPSECTunnelDeleteParams,
    type IPSECTunnelBulkUpdateParams as IPSECTunnelBulkUpdateParams,
    type IPSECTunnelGetParams as IPSECTunnelGetParams,
    type IPSECTunnelPSKGenerateParams as IPSECTunnelPSKGenerateParams,
  };

  export {
    Routes as Routes,
    type Scope as Scope,
    type RouteCreateResponse as RouteCreateResponse,
    type RouteUpdateResponse as RouteUpdateResponse,
    type RouteListResponse as RouteListResponse,
    type RouteDeleteResponse as RouteDeleteResponse,
    type RouteBulkUpdateResponse as RouteBulkUpdateResponse,
    type RouteEmptyResponse as RouteEmptyResponse,
    type RouteGetResponse as RouteGetResponse,
    type RouteCreateParams as RouteCreateParams,
    type RouteUpdateParams as RouteUpdateParams,
    type RouteListParams as RouteListParams,
    type RouteDeleteParams as RouteDeleteParams,
    type RouteBulkUpdateParams as RouteBulkUpdateParams,
    type RouteEmptyParams as RouteEmptyParams,
    type RouteGetParams as RouteGetParams,
  };

  export {
    Sites as Sites,
    type Site as Site,
    type SiteLocation as SiteLocation,
    SitesSinglePage as SitesSinglePage,
    type SiteCreateParams as SiteCreateParams,
    type SiteUpdateParams as SiteUpdateParams,
    type SiteListParams as SiteListParams,
    type SiteDeleteParams as SiteDeleteParams,
    type SiteEditParams as SiteEditParams,
    type SiteGetParams as SiteGetParams,
  };

  export {
    Connectors as Connectors,
    type ConnectorCreateResponse as ConnectorCreateResponse,
    type ConnectorUpdateResponse as ConnectorUpdateResponse,
    type ConnectorListResponse as ConnectorListResponse,
    type ConnectorDeleteResponse as ConnectorDeleteResponse,
    type ConnectorEditResponse as ConnectorEditResponse,
    type ConnectorGetResponse as ConnectorGetResponse,
    ConnectorListResponsesSinglePage as ConnectorListResponsesSinglePage,
    type ConnectorCreateParams as ConnectorCreateParams,
    type ConnectorUpdateParams as ConnectorUpdateParams,
    type ConnectorListParams as ConnectorListParams,
    type ConnectorDeleteParams as ConnectorDeleteParams,
    type ConnectorEditParams as ConnectorEditParams,
    type ConnectorGetParams as ConnectorGetParams,
  };

  export {
    PCAPs as PCAPs,
    type PCAP as PCAP,
    type PCAPFilter as PCAPFilter,
    type PCAPCreateResponse as PCAPCreateResponse,
    type PCAPListResponse as PCAPListResponse,
    type PCAPGetResponse as PCAPGetResponse,
    PCAPListResponsesSinglePage as PCAPListResponsesSinglePage,
    type PCAPCreateParams as PCAPCreateParams,
    type PCAPListParams as PCAPListParams,
    type PCAPGetParams as PCAPGetParams,
    type PCAPStopParams as PCAPStopParams,
  };
}
