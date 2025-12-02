import * as zlib from 'zlib';
import { Readable } from 'stream';
import { isExportRetryable, parseRetryAfterToMills, } from '../is-export-retryable';
import { OTLPExporterError } from '../types';
import { VERSION } from '../version';
const DEFAULT_USER_AGENT = `OTel-OTLP-Exporter-JavaScript/${VERSION}`;
/**
 * Sends data using http
 * @param request
 * @param params
 * @param agent
 * @param data
 * @param onDone
 * @param timeoutMillis
 */
export function sendWithHttp(request, url, headers, compression, userAgent, agent, data, onDone, timeoutMillis) {
    const parsedUrl = new URL(url);
    if (userAgent) {
        headers['User-Agent'] = `${userAgent} ${DEFAULT_USER_AGENT}`;
    }
    else {
        headers['User-Agent'] = DEFAULT_USER_AGENT;
    }
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'POST',
        headers,
        agent,
    };
    const req = request(options, (res) => {
        const responseData = [];
        res.on('data', chunk => responseData.push(chunk));
        res.on('end', () => {
            if (res.statusCode && res.statusCode < 299) {
                onDone({
                    status: 'success',
                    data: Buffer.concat(responseData),
                });
            }
            else if (res.statusCode && isExportRetryable(res.statusCode)) {
                onDone({
                    status: 'retryable',
                    retryInMillis: parseRetryAfterToMills(res.headers['retry-after']),
                });
            }
            else {
                const error = new OTLPExporterError(res.statusMessage, res.statusCode, Buffer.concat(responseData).toString());
                onDone({
                    status: 'failure',
                    error,
                });
            }
        });
    });
    req.setTimeout(timeoutMillis, () => {
        req.destroy();
        onDone({
            status: 'failure',
            error: new Error('Request Timeout'),
        });
    });
    req.on('error', (error) => {
        onDone({
            status: 'failure',
            error,
        });
    });
    compressAndSend(req, compression, data, (error) => {
        onDone({
            status: 'failure',
            error,
        });
    });
}
export function compressAndSend(req, compression, data, onError) {
    let dataStream = readableFromUint8Array(data);
    if (compression === 'gzip') {
        req.setHeader('Content-Encoding', 'gzip');
        dataStream = dataStream
            .on('error', onError)
            .pipe(zlib.createGzip())
            .on('error', onError);
    }
    dataStream.pipe(req).on('error', onError);
}
function readableFromUint8Array(buff) {
    const readable = new Readable();
    readable.push(buff);
    readable.push(null);
    return readable;
}
//# sourceMappingURL=http-transport-utils.js.map