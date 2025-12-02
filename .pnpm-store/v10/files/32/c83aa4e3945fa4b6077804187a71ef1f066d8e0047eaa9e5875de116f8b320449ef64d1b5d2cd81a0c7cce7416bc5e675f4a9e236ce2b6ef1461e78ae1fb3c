import { HttpRequest } from "@smithy/protocol-http";
import { getCacheKey } from "./getCacheKey";
import { updateDiscoveredEndpointInCache } from "./updateDiscoveredEndpointInCache";
export const endpointDiscoveryMiddleware = (config, middlewareConfig) => (next, context) => async (args) => {
    if (config.isCustomEndpoint) {
        if (config.isClientEndpointDiscoveryEnabled) {
            throw new Error(`Custom endpoint is supplied; endpointDiscoveryEnabled must not be true.`);
        }
        return next(args);
    }
    const { endpointDiscoveryCommandCtor } = config;
    const { isDiscoveredEndpointRequired, identifiers } = middlewareConfig;
    const clientName = context.clientName;
    const commandName = context.commandName;
    const isEndpointDiscoveryEnabled = await config.endpointDiscoveryEnabled();
    const cacheKey = await getCacheKey(commandName, config, { identifiers });
    if (isDiscoveredEndpointRequired) {
        if (isEndpointDiscoveryEnabled === false) {
            throw new Error(`Endpoint Discovery is disabled but ${commandName} on ${clientName} requires it.` +
                ` Please check your configurations.`);
        }
        await updateDiscoveredEndpointInCache(config, {
            ...middlewareConfig,
            commandName,
            cacheKey,
            endpointDiscoveryCommandCtor,
        });
    }
    else if (isEndpointDiscoveryEnabled) {
        updateDiscoveredEndpointInCache(config, {
            ...middlewareConfig,
            commandName,
            cacheKey,
            endpointDiscoveryCommandCtor,
        });
    }
    const { request } = args;
    if (cacheKey && HttpRequest.isInstance(request)) {
        const endpoint = config.endpointCache.getEndpoint(cacheKey);
        if (endpoint) {
            request.hostname = endpoint;
        }
    }
    return next(args);
};
