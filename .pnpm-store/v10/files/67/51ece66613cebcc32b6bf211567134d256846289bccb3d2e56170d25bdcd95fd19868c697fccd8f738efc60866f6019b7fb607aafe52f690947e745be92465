/**
 * NoOpSpan Implementation for Mastra Observability
 */
import type { ObservabilityInstance, SpanType, CreateSpanOptions, EndSpanOptions, UpdateSpanOptions, ErrorSpanOptions } from '@mastra/core/observability';
import { BaseSpan } from './base.js';
export declare class NoOpSpan<TType extends SpanType = any> extends BaseSpan<TType> {
    id: string;
    traceId: string;
    constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance);
    end(_options?: EndSpanOptions<TType>): void;
    error(_options: ErrorSpanOptions<TType>): void;
    update(_options: UpdateSpanOptions<TType>): void;
    get isValid(): boolean;
}
//# sourceMappingURL=no-op.d.ts.map