import type { GrpcInstrumentationConfig } from './types';
import { InstrumentationNodeModuleDefinition, InstrumentationBase } from '@opentelemetry/instrumentation';
export declare class GrpcInstrumentation extends InstrumentationBase<GrpcInstrumentationConfig> {
    private _metadataCapture;
    constructor(config?: GrpcInstrumentationConfig);
    init(): InstrumentationNodeModuleDefinition[];
    setConfig(config?: GrpcInstrumentationConfig): void;
    /**
     * Patch for grpc.Server.prototype.register(...) function. Provides auto-instrumentation for
     * client_stream, server_stream, bidi, unary server handler calls.
     */
    private _patchServer;
    /**
     * Patch for grpc.Client.make*Request(...) functions.
     * Provides auto-instrumentation for client requests when using a Client without
     * makeGenericClientConstructor/makeClientConstructor
     */
    private _patchClientRequestMethod;
    /**
     * Entry point for applying client patches to `grpc.makeClientConstructor(...)` equivalents
     * @param this GrpcJsPlugin
     */
    private _patchClient;
    /**
     * Entry point for client patching for grpc.loadPackageDefinition(...)
     * @param this - GrpcJsPlugin
     */
    private _patchLoadPackageDefinition;
    /**
     * Parse initial client call properties and start a span to trace its execution
     */
    private _getPatchedClientMethods;
    private _splitMethodString;
    private createClientSpan;
    private extractNetMetadata;
    /**
     * Utility function to patch *all* functions loaded through a proto file.
     * Recursively searches for Client classes and patches all methods, reversing the
     * parsing done by grpc.loadPackageDefinition
     * https://github.com/grpc/grpc-node/blob/1d14203c382509c3f36132bd0244c99792cb6601/packages/grpc-js/src/make-client.ts#L200-L217
     */
    private _patchLoadedPackage;
    private _createMetadataCapture;
}
//# sourceMappingURL=instrumentation.d.ts.map