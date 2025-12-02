import type { ContextManager } from '@opentelemetry/api';
import { TextMapPropagator } from '@opentelemetry/api';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { Detector, DetectorSync, IResource } from '@opentelemetry/resources';
import { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { MetricReader, View } from '@opentelemetry/sdk-metrics';
import { Sampler, SpanExporter, SpanLimits, SpanProcessor, IdGenerator } from '@opentelemetry/sdk-trace-base';
export interface NodeSDKConfiguration {
    autoDetectResources: boolean;
    contextManager: ContextManager;
    textMapPropagator: TextMapPropagator;
    /** @deprecated use logRecordProcessors instead*/
    logRecordProcessor: LogRecordProcessor;
    logRecordProcessors?: LogRecordProcessor[];
    metricReader: MetricReader;
    views: View[];
    instrumentations: (Instrumentation | Instrumentation[])[];
    resource: IResource;
    resourceDetectors: Array<Detector | DetectorSync>;
    mergeResourceWithDefaults?: boolean;
    sampler: Sampler;
    serviceName?: string;
    /** @deprecated use spanProcessors instead*/
    spanProcessor?: SpanProcessor;
    spanProcessors?: SpanProcessor[];
    traceExporter: SpanExporter;
    spanLimits: SpanLimits;
    idGenerator: IdGenerator;
}
//# sourceMappingURL=types.d.ts.map