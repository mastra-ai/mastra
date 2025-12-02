import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { MongoDBInstrumentationConfig } from './types';
/** mongodb instrumentation plugin for OpenTelemetry */
export declare class MongoDBInstrumentation extends InstrumentationBase<MongoDBInstrumentationConfig> {
    private _connectionsUsage;
    private _poolName;
    constructor(config?: MongoDBInstrumentationConfig);
    setConfig(config?: MongoDBInstrumentationConfig): void;
    _updateMetricInstruments(): void;
    init(): InstrumentationNodeModuleDefinition[];
    private _getV3ConnectionPatches;
    private _getV4SessionsPatches;
    private _getV4AcquireCommand;
    private _getV4ReleaseCommand;
    private _getV4ConnectionPoolPatches;
    private _getV4ConnectPatches;
    private _getV4ConnectionPoolCheckOut;
    private _getV4ConnectCommand;
    private _getV4ConnectionPatches;
    /** Creates spans for common operations */
    private _getV3PatchOperation;
    /** Creates spans for command operation */
    private _getV3PatchCommand;
    /** Creates spans for command operation */
    private _getV4PatchCommandCallback;
    private _getV4PatchCommandPromise;
    /** Creates spans for find operation */
    private _getV3PatchFind;
    /** Creates spans for find operation */
    private _getV3PatchCursor;
    /**
     * Get the mongodb command type from the object.
     * @param command Internal mongodb command object
     */
    private static _getCommandType;
    /**
     * Populate span's attributes by fetching related metadata from the context
     * @param span span to add attributes to
     * @param connectionCtx mongodb internal connection context
     * @param ns mongodb namespace
     * @param command mongodb internal representation of a command
     */
    private _populateV4Attributes;
    /**
     * Populate span's attributes by fetching related metadata from the context
     * @param span span to add attributes to
     * @param ns mongodb namespace
     * @param topology mongodb internal representation of the network topology
     * @param command mongodb internal representation of a command
     */
    private _populateV3Attributes;
    private _addAllSpanAttributes;
    private _defaultDbStatementSerializer;
    private _scrubStatement;
    /**
     * Triggers the response hook in case it is defined.
     * @param span The span to add the results to.
     * @param result The command result
     */
    private _handleExecutionResult;
    /**
     * Ends a created span.
     * @param span The created span to end.
     * @param resultHandler A callback function.
     * @param connectionId: The connection ID of the Command response.
     */
    private _patchEnd;
    private setPoolName;
    private _checkSkipInstrumentation;
}
//# sourceMappingURL=instrumentation.d.ts.map