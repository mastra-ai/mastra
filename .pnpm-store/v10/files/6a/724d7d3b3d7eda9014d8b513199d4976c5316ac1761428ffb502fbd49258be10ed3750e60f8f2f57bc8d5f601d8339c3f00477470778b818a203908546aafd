import { DiagLogger, Span, SpanAttributes, SpanKind, Tracer } from '@opentelemetry/api';
import { AwsSdkInstrumentationConfig, NormalizedRequest, NormalizedResponse } from '../types';
export interface RequestMetadata {
    isIncoming: boolean;
    spanAttributes?: SpanAttributes;
    spanKind?: SpanKind;
    spanName?: string;
}
export interface ServiceExtension {
    requestPreSpanHook: (request: NormalizedRequest, config: AwsSdkInstrumentationConfig, diag: DiagLogger) => RequestMetadata;
    requestPostSpanHook?: (request: NormalizedRequest) => void;
    responseHook?: (response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig) => void;
}
//# sourceMappingURL=ServiceExtension.d.ts.map