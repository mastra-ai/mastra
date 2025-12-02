import { Tracer, Span, Context, SpanAttributes } from '@opentelemetry/api';
interface SpanDetails {
    attributes: SpanAttributes;
    parentContext: Context;
    name: string;
}
declare type ProcessHook<T> = (processSpan: Span, message: T) => void;
interface PatchForProcessingPayload<T> {
    messages: T[];
    tracer: Tracer;
    parentContext: Context;
    messageToSpanDetails: (message: T) => SpanDetails;
    processHook?: ProcessHook<T>;
}
declare const _default: {
    patchMessagesArrayToStartProcessSpans: <T>({ messages, tracer, parentContext, messageToSpanDetails, processHook, }: PatchForProcessingPayload<T>) => void;
    patchArrayForProcessSpans: (messages: unknown[], tracer: Tracer, loopContext?: Context) => void;
};
export default _default;
//# sourceMappingURL=pubsub-propagation.d.ts.map