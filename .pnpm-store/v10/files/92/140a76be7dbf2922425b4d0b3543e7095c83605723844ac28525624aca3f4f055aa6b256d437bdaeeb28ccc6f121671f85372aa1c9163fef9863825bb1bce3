import { EndpointDiscoveryMiddlewareConfig } from "./getEndpointDiscoveryPlugin";
import {
  EndpointDiscoveryResolvedConfig,
  PreviouslyResolved,
} from "./resolveEndpointDiscoveryConfig";
export interface UpdateDiscoveredEndpointInCacheOptions
  extends EndpointDiscoveryMiddlewareConfig {
  cacheKey: string;
  commandName: string;
  endpointDiscoveryCommandCtor: new (comandConfig: any) => any;
}
export declare const updateDiscoveredEndpointInCache: (
  config: EndpointDiscoveryResolvedConfig & PreviouslyResolved,
  options: UpdateDiscoveredEndpointInCacheOptions
) => Promise<void>;
