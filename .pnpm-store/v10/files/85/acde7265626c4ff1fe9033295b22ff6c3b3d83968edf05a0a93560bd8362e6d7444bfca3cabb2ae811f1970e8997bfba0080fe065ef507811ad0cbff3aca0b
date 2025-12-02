import { BuildHandlerOptions, HttpHandlerOptions, MiddlewareStack, Pluggable } from "@smithy/types";
import { EndpointDiscoveryResolvedConfig, PreviouslyResolved } from "./resolveEndpointDiscoveryConfig";
/**
 * @internal
 */
export declare const endpointDiscoveryMiddlewareOptions: BuildHandlerOptions;
/**
 * @public
 */
export interface EndpointDiscoveryMiddlewareConfig {
    isDiscoveredEndpointRequired: boolean;
    clientStack: MiddlewareStack<any, any>;
    options?: HttpHandlerOptions;
    identifiers?: Record<string, string>;
}
/**
 * @internal
 */
export declare const getEndpointDiscoveryPlugin: (pluginConfig: EndpointDiscoveryResolvedConfig & PreviouslyResolved, middlewareConfig: EndpointDiscoveryMiddlewareConfig) => Pluggable<any, any>;
/**
 * @internal
 * @deprecated Use getEndpointDiscoveryPlugin
 */
export declare const getEndpointDiscoveryRequiredPlugin: (pluginConfig: EndpointDiscoveryResolvedConfig & PreviouslyResolved, middlewareConfig: Omit<EndpointDiscoveryMiddlewareConfig, "isDiscoveredEndpointRequired">) => Pluggable<any, any>;
/**
 * @internal
 * @deprecated Use getEndpointDiscoveryPlugin
 */
export declare const getEndpointDiscoveryOptionalPlugin: (pluginConfig: EndpointDiscoveryResolvedConfig & PreviouslyResolved, middlewareConfig: Omit<EndpointDiscoveryMiddlewareConfig, "isDiscoveredEndpointRequired">) => Pluggable<any, any>;
