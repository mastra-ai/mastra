import { Span, Tracer } from '@opentelemetry/api';
import { AwsSdkInstrumentationConfig, NormalizedRequest, NormalizedResponse } from '../types';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
export declare class LambdaServiceExtension implements ServiceExtension {
    requestPreSpanHook(request: NormalizedRequest, _config: AwsSdkInstrumentationConfig): RequestMetadata;
    requestPostSpanHook: (request: NormalizedRequest) => void;
    responseHook(response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig): void;
    extractFunctionName: (commandInput: Record<string, any>) => string;
}
//# sourceMappingURL=lambda.d.ts.map