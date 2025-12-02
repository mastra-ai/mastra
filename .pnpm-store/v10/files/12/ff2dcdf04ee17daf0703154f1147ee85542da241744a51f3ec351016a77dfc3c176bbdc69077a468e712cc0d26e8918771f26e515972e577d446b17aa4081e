import { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { MetricReader, View } from '@opentelemetry/sdk-metrics';
import { NodeSDKConfiguration } from './types';
/** This class represents everything needed to register a fully configured OpenTelemetry Node.js SDK */
export declare type MeterProviderConfig = {
    /**
     * Reference to the MetricReader instance by the NodeSDK
     */
    reader?: MetricReader;
    /**
     * List of {@link View}s that should be passed to the MeterProvider
     */
    views?: View[];
};
export declare type LoggerProviderConfig = {
    /**
     * Reference to the LoggerRecordProcessor instance by the NodeSDK
     */
    logRecordProcessors: LogRecordProcessor[];
};
export declare class NodeSDK {
    private _tracerProviderConfig?;
    private _loggerProviderConfig?;
    private _meterProviderConfig?;
    private _instrumentations;
    private _resource;
    private _resourceDetectors;
    private _mergeResourceWithDefaults;
    private _autoDetectResources;
    private _tracerProvider?;
    private _loggerProvider?;
    private _meterProvider?;
    private _serviceName?;
    private _configuration?;
    private _disabled?;
    /**
     * Create a new NodeJS SDK instance
     */
    constructor(configuration?: Partial<NodeSDKConfiguration>);
    /**
     * Call this method to construct SDK components and register them with the OpenTelemetry API.
     */
    start(): void;
    shutdown(): Promise<void>;
    private configureLoggerProviderFromEnv;
}
//# sourceMappingURL=sdk.d.ts.map