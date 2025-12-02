import { DiagLogger, Span, Tracer } from '@opentelemetry/api';
import { RequestMetadata, ServiceExtension } from './ServiceExtension';
import { AwsSdkInstrumentationConfig, NormalizedRequest, NormalizedResponse } from '../types';
export declare class DynamodbServiceExtension implements ServiceExtension {
    toArray<T>(values: T | T[]): T[];
    requestPreSpanHook(normalizedRequest: NormalizedRequest, config: AwsSdkInstrumentationConfig, diag: DiagLogger): RequestMetadata;
    responseHook(response: NormalizedResponse, span: Span, _tracer: Tracer, _config: AwsSdkInstrumentationConfig): void;
}
//# sourceMappingURL=dynamodb.d.ts.map