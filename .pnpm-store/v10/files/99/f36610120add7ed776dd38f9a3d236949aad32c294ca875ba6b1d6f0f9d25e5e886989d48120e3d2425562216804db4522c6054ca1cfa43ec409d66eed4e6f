import { Span } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
export declare type LogHookFunction = (span: Span, record: Record<string, any>) => void;
export interface WinstonInstrumentationConfig extends InstrumentationConfig {
    /**
     * Whether to disable the automatic sending of log records to the
     * OpenTelemetry Logs SDK.
     * @default false
     */
    disableLogSending?: boolean;
    /**
     * Control Log sending severity level, logs will be sent for  specified severity and higher.
     */
    logSeverity?: SeverityNumber;
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
}
//# sourceMappingURL=types.d.ts.map