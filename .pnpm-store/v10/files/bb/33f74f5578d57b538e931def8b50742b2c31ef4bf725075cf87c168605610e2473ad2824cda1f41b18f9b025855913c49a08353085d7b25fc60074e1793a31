import { Span } from '@opentelemetry/api';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export declare const defaultSocketIoPath = "/socket.io/";
export interface SocketIoHookInfo {
    moduleVersion?: string;
    payload: any[];
}
export interface SocketIoHookFunction {
    (span: Span, hookInfo: SocketIoHookInfo): void;
}
export interface SocketIoInstrumentationConfig extends InstrumentationConfig {
    /** Hook for adding custom attributes before socket.io emits the event */
    emitHook?: SocketIoHookFunction;
    /** list of events to ignore tracing on for socket.io emits */
    emitIgnoreEventList?: string[];
    /** Hook for adding custom attributes before the event listener (callback) is invoked */
    onHook?: SocketIoHookFunction;
    /** list of events to ignore tracing on for socket.io listeners */
    onIgnoreEventList?: string[];
    /** Set to `true` if you want to trace socket.io reserved events (see https://socket.io/docs/v4/emit-cheatsheet/#Reserved-events) */
    traceReserved?: boolean;
}
//# sourceMappingURL=types.d.ts.map