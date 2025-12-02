import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export declare type IgnoreMatcher = string | RegExp | ((str: string) => boolean);
export interface GrpcInstrumentationConfig extends InstrumentationConfig {
    ignoreGrpcMethods?: IgnoreMatcher[];
    /** Map the following gRPC metadata to span attributes. */
    metadataToSpanAttributes?: {
        client?: {
            responseMetadata?: string[];
            requestMetadata?: string[];
        };
        server?: {
            responseMetadata?: string[];
            requestMetadata?: string[];
        };
    };
}
//# sourceMappingURL=types.d.ts.map