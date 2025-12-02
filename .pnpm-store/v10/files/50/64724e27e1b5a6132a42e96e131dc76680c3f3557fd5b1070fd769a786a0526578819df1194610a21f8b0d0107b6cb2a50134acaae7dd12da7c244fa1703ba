import { EndpointCache } from "@aws-sdk/endpoint-cache";
import {
  AwsCredentialIdentity,
  MemoizedProvider,
  Provider,
} from "@smithy/types";
export interface PreviouslyResolved {
  isCustomEndpoint?: boolean;
  credentials: MemoizedProvider<AwsCredentialIdentity>;
  endpointDiscoveryEnabledProvider: Provider<boolean | undefined>;
}
export interface EndpointDiscoveryInputConfig {
  endpointCacheSize?: number;
  endpointDiscoveryEnabled?: boolean | undefined;
}
export interface EndpointDiscoveryResolvedConfig {
  endpointCache: EndpointCache;
  endpointDiscoveryCommandCtor: new (comandConfig: any) => any;
  endpointDiscoveryEnabled: Provider<boolean | undefined>;
  isClientEndpointDiscoveryEnabled: boolean;
}
export interface EndpointDiscoveryConfigOptions {
  endpointDiscoveryCommandCtor: new (comandConfig: any) => any;
}
export declare const resolveEndpointDiscoveryConfig: <T>(
  input: T & PreviouslyResolved & EndpointDiscoveryInputConfig,
  { endpointDiscoveryCommandCtor }: EndpointDiscoveryConfigOptions
) => T & EndpointDiscoveryResolvedConfig;
