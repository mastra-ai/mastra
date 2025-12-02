"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStream = isStream;
exports.getAsText = getAsText;
exports.mapStream = mapStream;
const stream_1 = __importDefault(require("stream"));
const buffer_1 = require("buffer");
const { MAX_STRING_LENGTH } = buffer_1.constants;
function isStream(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'pipe' in obj &&
        typeof obj.pipe === 'function' &&
        'on' in obj &&
        typeof obj.on === 'function');
}
async function getAsText(stream) {
    let text = '';
    const textDecoder = new TextDecoder();
    for await (const chunk of stream) {
        const decoded = textDecoder.decode(chunk, { stream: true });
        if (decoded.length + text.length > MAX_STRING_LENGTH) {
            throw new Error('The response length exceeds the maximum allowed size of V8 String: ' +
                `${MAX_STRING_LENGTH}; consider limiting the amount of requested rows.`);
        }
        text += decoded;
    }
    // flush
    const last = textDecoder.decode();
    if (last) {
        text += last;
    }
    return text;
}
function mapStream(mapper) {
    return new stream_1.default.Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
            callback(null, mapper(chunk));
        },
    });
}
//# sourceMappingURL=stream.js.map