/**
 * A Bunyan stream for sending log records to the OpenTelemetry Logs SDK.
 */
export declare class OpenTelemetryBunyanStream {
    private _otelLogger;
    constructor();
    /**
     * Convert from https://github.com/trentm/node-bunyan#log-record-fields
     * to https://opentelemetry.io/docs/specs/otel/logs/data-model/
     *
     * Dev Notes:
     * - We drop the Bunyan 'v' field. It is meant to indicate the format
     *   of the Bunyan log record. FWIW, it has always been `0`.
     * - The standard Bunyan `hostname` and `pid` fields are removed because they
     *   are redundant with the OpenTelemetry `host.name` and `process.pid`
     *   Resource attributes, respectively. This code cannot change the
     *   LoggerProvider's `resource`, so getting the OpenTelemetry equivalents
     *   depends on the user using relevant OpenTelemetry resource detectors.
     *   "examples/telemetry.js" shows using HostDetector and ProcessDetector for
     *   this.
     * - The Bunyan `name` field *could* naturally map to OpenTelemetry's
     *   `service.name` resource attribute. However, that is debatable, as some
     *   users might use `name` more like a log4j logger name.
     * - Strip the `trace_id` et al fields that may have been added by the
     *   the _emit wrapper.
     */
    write(rec: Record<string, any>): void;
}
//# sourceMappingURL=OpenTelemetryBunyanStream.d.ts.map