import { EndpointCache } from "@aws-sdk/endpoint-cache";
export const resolveEndpointDiscoveryConfig = (input, { endpointDiscoveryCommandCtor }) => {
    const { endpointCacheSize, endpointDiscoveryEnabled, endpointDiscoveryEnabledProvider } = input;
    return Object.assign(input, {
        endpointDiscoveryCommandCtor,
        endpointCache: new EndpointCache(endpointCacheSize ?? 1000),
        endpointDiscoveryEnabled: endpointDiscoveryEnabled !== undefined
            ? () => Promise.resolve(endpointDiscoveryEnabled)
            : endpointDiscoveryEnabledProvider,
        isClientEndpointDiscoveryEnabled: endpointDiscoveryEnabled !== undefined,
    });
};
