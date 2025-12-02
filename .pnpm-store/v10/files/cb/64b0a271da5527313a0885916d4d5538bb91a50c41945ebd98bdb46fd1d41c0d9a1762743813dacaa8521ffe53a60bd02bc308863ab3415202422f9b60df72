import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { MeterProvider, TracerProvider } from '@opentelemetry/api';
import { AwsLambdaInstrumentationConfig } from './types';
export declare const lambdaMaxInitInMilliseconds = 10000;
export declare class AwsLambdaInstrumentation extends InstrumentationBase<AwsLambdaInstrumentationConfig> {
    private _traceForceFlusher?;
    private _metricForceFlusher?;
    constructor(config?: AwsLambdaInstrumentationConfig);
    init(): InstrumentationNodeModuleDefinition[];
    private _getHandler;
    private _getPatchHandler;
    setTracerProvider(tracerProvider: TracerProvider): void;
    private _traceForceFlush;
    setMeterProvider(meterProvider: MeterProvider): void;
    private _metricForceFlush;
    private _wrapCallback;
    private _endSpan;
    private _applyResponseHook;
    private static _extractAccountId;
    private static _defaultEventContextExtractor;
    private static _extractOtherEventFields;
    private static _extractFullUrl;
    private static _determineParent;
}
//# sourceMappingURL=instrumentation.d.ts.map