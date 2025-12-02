import type { LogWriter } from '@clickhouse/client-common';
import type Http from 'http';
import Stream from 'stream';
type DecompressResponseResult = {
    response: Stream.Readable;
} | {
    error: Error;
};
export declare function decompressResponse(response: Http.IncomingMessage, logWriter: LogWriter): DecompressResponseResult;
export declare function isDecompressionError(result: any): result is {
    error: Error;
};
export {};
