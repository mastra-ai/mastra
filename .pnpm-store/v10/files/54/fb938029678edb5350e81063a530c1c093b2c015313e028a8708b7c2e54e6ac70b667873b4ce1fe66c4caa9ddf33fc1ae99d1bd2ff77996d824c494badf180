/// <reference types="node" />
import { Writable } from 'stream';
/**
 * Return a function that knows how to convert the "time" field value on a
 * Pino log record to an OTel LogRecord timestamp value.
 *
 * How to convert the serialized "time" on a Pino log record
 * depends on the Logger's `Symbol(pino.time)` prop, configurable
 * via https://getpino.io/#/docs/api?id=timestamp-boolean-function
 *
 * For example:
 *    const logger = pino({timestamp: pino.stdTimeFunctions.isoTime})
 * results in log record entries of the form:
 *    ,"time":"2024-05-17T22:03:25.969Z"
 * `otelTimestampFromTime` will be given the value of the "time" field:
 *   "2024-05-17T22:03:25.969Z"
 * which should be parsed to a number of milliseconds since the epoch.
 */
export declare function getTimeConverter(pinoLogger: any, pinoMod: any): ((time: number) => number) | ((time: string) => number);
interface OTelPinoStreamOptions {
    messageKey: string;
    levels: any;
    otelTimestampFromTime: (time: any) => number;
}
/**
 * A Pino stream for sending records to the OpenTelemetry Logs API.
 *
 * - This stream emits an 'unknown' event on an unprocessable pino record.
 *   The event arguments are: `logLine: string`, `err: string | Error`.
 */
export declare class OTelPinoStream extends Writable {
    private _otelLogger;
    private _messageKey;
    private _levels;
    private _otelTimestampFromTime;
    constructor(options: OTelPinoStreamOptions);
    _write(s: string, _encoding: string, callback: Function): void;
}
export {};
//# sourceMappingURL=log-sending-utils.d.ts.map