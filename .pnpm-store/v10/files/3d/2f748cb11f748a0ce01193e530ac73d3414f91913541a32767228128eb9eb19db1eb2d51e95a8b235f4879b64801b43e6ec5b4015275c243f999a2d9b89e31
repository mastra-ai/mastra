import { EndpointCache } from "@aws-sdk/endpoint-cache";
import { AwsCredentialIdentity, MemoizedProvider, Provider } from "@smithy/types";
/**
 * @internal
 */
export interface PreviouslyResolved {
    isCustomEndpoint?: boolean;
    credentials: MemoizedProvider<AwsCredentialIdentity>;
    endpointDiscoveryEnabledProvider: Provider<boolean | undefined>;
}
/**
 * @public
 */
export interface EndpointDiscoveryInputConfig {
    /**
     * The size of the client cache storing endpoints from endpoint discovery operations.
     * Defaults to 1000.
     */
    endpointCacheSize?: number;
    /**
     * Whether to call operations with endpoints given by service dynamically.
     * Setting this config to `true` will enable endpoint discovery for all applicable operations.
     * Setting it to `false` will explicitly disable endpoint discovery even though operations that
     * require endpoint discovery will presumably fail. Leaving it to undefined means SDK only do
     * endpoint discovery when it's required. Defaults to `undefined`.
     */
    endpointDiscoveryEnabled?: boolean | undefined;
}
export interface EndpointDiscoveryResolvedConfig {
    /**
     * LRU Cache which stores endpoints from endpoint discovery operations.
     * The size is either provided by {@link EndpointDiscoveryInputConfig.endpointCacheSize}.
     */
    endpointCache: EndpointCache;
    /**
     * The constructor of the Command used for discovering endpoints.
     * @internal
     */
    endpointDiscoveryCommandCtor: new (comandConfig: any) => any;
    /**
     * Resolved value for input config {@link EndpointDiscoveryInputConfig.endpointDiscoveryEnabled}.
     */
    endpointDiscoveryEnabled: Provider<boolean | undefined>;
    /**
     * Stores whether endpoint discovery configuration is set locally by passing
     * {@link EndpointDiscoveryInputConfig.endpointDiscoveryEnabled} during client creation.
     * @internal
     */
    isClientEndpointDiscoveryEnabled: boolean;
}
export interface EndpointDiscoveryConfigOptions {
    /**
     * The constructor of the Command used for discovering endpoints.
     */
    endpointDiscoveryCommandCtor: new (comandConfig: any) => any;
}
/**
 * @internal
 */
export declare const resolveEndpointDiscoveryConfig: <T>(input: T & PreviouslyResolved & EndpointDiscoveryInputConfig, { endpointDiscoveryCommandCtor }: EndpointDiscoveryConfigOptions) => T & EndpointDiscoveryResolvedConfig;
