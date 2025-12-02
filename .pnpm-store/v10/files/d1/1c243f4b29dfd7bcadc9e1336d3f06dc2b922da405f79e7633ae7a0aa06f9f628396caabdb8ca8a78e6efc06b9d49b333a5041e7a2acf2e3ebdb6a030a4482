"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drainStream = drainStream;
/** Drains the response stream, as calling `destroy` on a {@link Stream.Readable} response stream
 *  will result in closing the underlying socket, and negate the KeepAlive feature benefits.
 *  See https://github.com/ClickHouse/clickhouse-js/pull/203 */
async function drainStream(stream) {
    return new Promise((resolve, reject) => {
        function dropData() {
            // used only for the methods without expected response; we don't care about the data here
        }
        function onEnd() {
            removeListeners();
            resolve();
        }
        function onError(err) {
            removeListeners();
            reject(err);
        }
        function onClose() {
            removeListeners();
        }
        function removeListeners() {
            stream.removeListener('data', dropData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            stream.removeListener('onClose', onClose);
        }
        stream.on('data', dropData);
        stream.on('end', onEnd);
        stream.on('error', onError);
        stream.on('close', onClose);
    });
}
//# sourceMappingURL=stream.js.map