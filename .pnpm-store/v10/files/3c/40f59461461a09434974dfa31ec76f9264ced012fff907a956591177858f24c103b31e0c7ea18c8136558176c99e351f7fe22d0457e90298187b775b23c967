"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultSet = void 0;
const client_common_1 = require("@clickhouse/client-common");
const buffer_1 = require("buffer");
const stream_1 = __importStar(require("stream"));
const utils_1 = require("./utils");
const NEWLINE = 0x0a;
class ResultSet {
    constructor(_stream, format, query_id, log_error, _response_headers) {
        Object.defineProperty(this, "_stream", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _stream
        });
        Object.defineProperty(this, "format", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: format
        });
        Object.defineProperty(this, "query_id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: query_id
        });
        Object.defineProperty(this, "response_headers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "log_error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // eslint-disable-next-line no-console
        this.log_error = log_error ?? ((err) => console.error(err));
        this.response_headers =
            _response_headers !== undefined ? Object.freeze(_response_headers) : {};
    }
    /** See {@link BaseResultSet.text}. */
    async text() {
        if (this._stream.readableEnded) {
            throw Error(streamAlreadyConsumedMessage);
        }
        return (await (0, utils_1.getAsText)(this._stream)).toString();
    }
    /** See {@link BaseResultSet.json}. */
    async json() {
        if (this._stream.readableEnded) {
            throw Error(streamAlreadyConsumedMessage);
        }
        // JSONEachRow, etc.
        if ((0, client_common_1.isStreamableJSONFamily)(this.format)) {
            const result = [];
            const stream = this.stream();
            for await (const rows of stream) {
                for (const row of rows) {
                    result.push(row.json());
                }
            }
            return result;
        }
        // JSON, JSONObjectEachRow, etc.
        if ((0, client_common_1.isNotStreamableJSONFamily)(this.format)) {
            const text = await (0, utils_1.getAsText)(this._stream);
            return JSON.parse(text);
        }
        // should not be called for CSV, etc.
        throw new Error(`Cannot decode ${this.format} as JSON`);
    }
    /** See {@link BaseResultSet.stream}. */
    stream() {
        // If the underlying stream has already ended by calling `text` or `json`,
        // Stream.pipeline will create a new empty stream
        // but without "readableEnded" flag set to true
        if (this._stream.readableEnded) {
            throw Error(streamAlreadyConsumedMessage);
        }
        (0, client_common_1.validateStreamFormat)(this.format);
        let incompleteChunks = [];
        const logError = this.log_error;
        const toRows = new stream_1.Transform({
            transform(chunk, _encoding, callback) {
                const rows = [];
                let lastIdx = 0;
                // first pass on the current chunk
                // using the incomplete row from the previous chunks
                let idx = chunk.indexOf(NEWLINE);
                if (idx !== -1) {
                    let text;
                    if (incompleteChunks.length > 0) {
                        text = buffer_1.Buffer.concat([...incompleteChunks, chunk.subarray(0, idx)], incompleteChunks.reduce((sz, buf) => sz + buf.length, 0) + idx).toString();
                        incompleteChunks = [];
                    }
                    else {
                        text = chunk.subarray(0, idx).toString();
                    }
                    rows.push({
                        text,
                        json() {
                            return JSON.parse(text);
                        },
                    });
                    lastIdx = idx + 1; // skipping newline character
                    // consequent passes on the current chunk with at least one row parsed
                    // all previous chunks with incomplete rows were already processed
                    do {
                        idx = chunk.indexOf(NEWLINE, lastIdx);
                        if (idx !== -1) {
                            const text = chunk.subarray(lastIdx, idx).toString();
                            rows.push({
                                text,
                                json() {
                                    return JSON.parse(text);
                                },
                            });
                        }
                        else {
                            // to be processed during the first pass for the next chunk
                            incompleteChunks.push(chunk.subarray(lastIdx));
                            this.push(rows);
                        }
                        lastIdx = idx + 1; // skipping newline character
                    } while (idx !== -1);
                }
                else {
                    incompleteChunks.push(chunk); // this chunk does not contain a full row
                }
                callback();
            },
            autoDestroy: true,
            objectMode: true,
        });
        const pipeline = stream_1.default.pipeline(this._stream, toRows, function pipelineCb(err) {
            if (err &&
                err.name !== 'AbortError' &&
                err.message !== resultSetClosedMessage) {
                logError(err);
            }
        });
        return pipeline;
    }
    /** See {@link BaseResultSet.close}. */
    close() {
        this._stream.destroy(new Error(resultSetClosedMessage));
    }
    static instance({ stream, format, query_id, log_error, response_headers, }) {
        return new ResultSet(stream, format, query_id, log_error, response_headers);
    }
}
exports.ResultSet = ResultSet;
const streamAlreadyConsumedMessage = 'Stream has been already consumed';
const resultSetClosedMessage = 'ResultSet has been closed';
//# sourceMappingURL=result_set.js.map