import { Span } from '@opentelemetry/api';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export declare type LogHookFunction = (span: Span, record: Record<string, any>, level?: number) => void;
export interface PinoInstrumentationConfig extends InstrumentationConfig {
    /**
     * Whether to disable the automatic sending of log records to the
     * OpenTelemetry Logs SDK.
     * @default false
     */
    disableLogSending?: boolean;
    /**
     * Whether to disable the injection trace-context fields, and possibly other
     * fields from `logHook()`, into log records for log correlation.
     * @default false
     */
    disableLogCorrelation?: boolean;
    /**
     * A function that allows injecting additional fields in log records. It is
     * called, as `logHook(span, record)`, for each log record emitted in a valid
     * span context. It requires `disableLogCorrelation` to be false.
     */
    logHook?: LogHookFunction;
    /**
     * Configure the names of field injected into logs when there is span context
     * available.
     */
    logKeys?: {
        traceId: string;
        spanId: string;
        traceFlags: string;
    };
}
//# sourceMappingURL=types.d.ts.map