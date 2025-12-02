"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decode = exports.encode = exports.encodeBase64 = exports.decodeBase64 = void 0;
const node_buffer_1 = require("node:buffer");
const buffer_utils_js_1 = require("../lib/buffer_utils.js");
function normalize(input) {
    let encoded = input;
    if (encoded instanceof Uint8Array) {
        encoded = buffer_utils_js_1.decoder.decode(encoded);
    }
    return encoded;
}
const encode = (input) => node_buffer_1.Buffer.from(input).toString('base64url');
exports.encode = encode;
const decodeBase64 = (input) => new Uint8Array(node_buffer_1.Buffer.from(input, 'base64'));
exports.decodeBase64 = decodeBase64;
const encodeBase64 = (input) => node_buffer_1.Buffer.from(input).toString('base64');
exports.encodeBase64 = encodeBase64;
const decode = (input) => new Uint8Array(node_buffer_1.Buffer.from(normalize(input), 'base64'));
exports.decode = decode;
