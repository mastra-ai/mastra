import { BuildHandler, HandlerExecutionContext, MetadataBearer } from "@smithy/types";
import { EndpointDiscoveryMiddlewareConfig } from "./getEndpointDiscoveryPlugin";
import { EndpointDiscoveryResolvedConfig, PreviouslyResolved } from "./resolveEndpointDiscoveryConfig";
export declare const endpointDiscoveryMiddleware: (config: EndpointDiscoveryResolvedConfig & PreviouslyResolved, middlewareConfig: EndpointDiscoveryMiddlewareConfig) => <Output extends MetadataBearer = MetadataBearer>(next: BuildHandler<any, Output>, context: HandlerExecutionContext) => BuildHandler<any, Output>;
