import { Span } from '@opentelemetry/api';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export declare enum LayerType {
    MIDDLEWARE = "middleware",
    REQUEST_HANDLER = "request_handler"
}
export interface RestifyRequestInfo {
    request: any;
    layerType: LayerType;
}
/**
 * Function that can be used to add custom attributes to the current span
 * @param span - The restify handler span.
 * @param info - The restify request info object.
 */
export interface RestifyCustomAttributeFunction {
    (span: Span, info: RestifyRequestInfo): void;
}
/**
 * Options available for the restify Instrumentation
 */
export interface RestifyInstrumentationConfig extends InstrumentationConfig {
    /** Function for adding custom attributes to each handler span */
    requestHook?: RestifyCustomAttributeFunction;
}
//# sourceMappingURL=types.d.ts.map