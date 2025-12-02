import { Tracer, Span } from '@opentelemetry/api';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
import { AwsSdkInstrumentationConfig, NormalizedRequest, NormalizedResponse } from '../types';
export declare class SqsServiceExtension implements ServiceExtension {
    requestPreSpanHook(request: NormalizedRequest, _config: AwsSdkInstrumentationConfig): RequestMetadata;
    requestPostSpanHook: (request: NormalizedRequest) => void;
    responseHook: (response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig) => void;
    extractQueueUrl: (commandInput: Record<string, any>) => string;
    extractQueueNameFromUrl: (queueUrl: string) => string | undefined;
}
//# sourceMappingURL=sqs.d.ts.map