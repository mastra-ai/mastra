"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decompressResponse = decompressResponse;
exports.isDecompressionError = isDecompressionError;
const stream_1 = __importDefault(require("stream"));
const zlib_1 = __importDefault(require("zlib"));
function decompressResponse(response, logWriter) {
    const encoding = response.headers['content-encoding'];
    if (encoding === 'gzip') {
        return {
            response: stream_1.default.pipeline(response, zlib_1.default.createGunzip(), function pipelineCb(err) {
                if (err) {
                    logWriter.error({
                        message: 'An error occurred while decompressing the response',
                        err,
                    });
                }
            }),
        };
    }
    else if (encoding !== undefined) {
        return {
            error: new Error(`Unexpected encoding: ${encoding}`),
        };
    }
    return { response };
}
function isDecompressionError(result) {
    return result.error !== undefined;
}
//# sourceMappingURL=compression.js.map