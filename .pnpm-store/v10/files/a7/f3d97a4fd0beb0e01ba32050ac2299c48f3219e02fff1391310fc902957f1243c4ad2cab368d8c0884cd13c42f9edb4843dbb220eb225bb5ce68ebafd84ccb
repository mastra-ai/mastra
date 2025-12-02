import type { SpanType, ObservabilityInstance, EndSpanOptions, ErrorSpanOptions, UpdateSpanOptions, CreateSpanOptions } from '@mastra/core/observability';
import { BaseSpan } from './base.js';
export declare class DefaultSpan<TType extends SpanType> extends BaseSpan<TType> {
    id: string;
    traceId: string;
    constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance);
    end(options?: EndSpanOptions<TType>): void;
    error(options: ErrorSpanOptions<TType>): void;
    update(options: UpdateSpanOptions<TType>): void;
    get isValid(): boolean;
    export(): Promise<string>;
}
//# sourceMappingURL=default.d.ts.map