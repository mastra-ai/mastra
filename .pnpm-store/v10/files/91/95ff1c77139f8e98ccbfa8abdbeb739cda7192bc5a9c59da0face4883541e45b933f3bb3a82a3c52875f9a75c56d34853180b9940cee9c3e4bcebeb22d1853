import { Span, Tracer } from '@opentelemetry/api';
import { NormalizedRequest, NormalizedResponse, AwsSdkInstrumentationConfig } from '../types';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
export declare class SnsServiceExtension implements ServiceExtension {
    requestPreSpanHook(request: NormalizedRequest, _config: AwsSdkInstrumentationConfig): RequestMetadata;
    requestPostSpanHook(request: NormalizedRequest): void;
    responseHook(response: NormalizedResponse, span: Span, tracer: Tracer, config: AwsSdkInstrumentationConfig): void;
    extractDestinationName(topicArn: string, targetArn: string, phoneNumber: string): string;
}
//# sourceMappingURL=sns.d.ts.map