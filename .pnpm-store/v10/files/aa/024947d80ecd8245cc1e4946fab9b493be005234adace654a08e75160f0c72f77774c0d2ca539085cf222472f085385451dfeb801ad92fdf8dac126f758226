type TraceId = string;
type SpanId = string;
type SerializedNanoseconds = string;
export declare class Reporter {
    spans: CompletedSpan[];
    emit(span: CompletedSpan): void;
}
export declare class Span {
    private reporter;
    private traceId;
    private parentId;
    private spanId;
    private beginTimeUnixNs;
    private name;
    private properties;
    private events;
    private constructor();
    static noop(): Span;
    static root(reporter: Reporter, name: string): Span;
    setProperty(key: string, value: string): void;
    childSpan(name: string): Span;
    enter<T>(name: string, f: (span: Span) => T): T;
    enterAsync<T>(name: string, f: (span: Span) => Promise<T>): Promise<T>;
    end(): void;
    encodeW3CTraceparent(): string;
}
type CompletedSpan = {
    traceId: TraceId;
    parentId: SpanId;
    spanId: SpanId;
    beginTimeUnixNs: SerializedNanoseconds;
    durationNs: SerializedNanoseconds;
    name: string;
    properties: Record<string, string>;
    events: SerializedEventRecord[];
};
type SerializedEventRecord = {
    name: string;
    timestampUnixNs: SerializedNanoseconds;
    properties: Record<string, string>;
};
export {};
//# sourceMappingURL=tracing.d.ts.map