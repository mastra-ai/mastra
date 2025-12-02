import { endpointDiscoveryMiddleware } from "./endpointDiscoveryMiddleware";
export const endpointDiscoveryMiddlewareOptions = {
    name: "endpointDiscoveryMiddleware",
    step: "build",
    tags: ["ENDPOINT_DISCOVERY"],
    override: true,
};
export const getEndpointDiscoveryPlugin = (pluginConfig, middlewareConfig) => ({
    applyToStack: (commandStack) => {
        commandStack.add(endpointDiscoveryMiddleware(pluginConfig, middlewareConfig), endpointDiscoveryMiddlewareOptions);
    },
});
export const getEndpointDiscoveryRequiredPlugin = (pluginConfig, middlewareConfig) => ({
    applyToStack: (commandStack) => {
        commandStack.add(endpointDiscoveryMiddleware(pluginConfig, { ...middlewareConfig, isDiscoveredEndpointRequired: true }), endpointDiscoveryMiddlewareOptions);
    },
});
export const getEndpointDiscoveryOptionalPlugin = (pluginConfig, middlewareConfig) => ({
    applyToStack: (commandStack) => {
        commandStack.add(endpointDiscoveryMiddleware(pluginConfig, { ...middlewareConfig, isDiscoveredEndpointRequired: false }), endpointDiscoveryMiddlewareOptions);
    },
});
