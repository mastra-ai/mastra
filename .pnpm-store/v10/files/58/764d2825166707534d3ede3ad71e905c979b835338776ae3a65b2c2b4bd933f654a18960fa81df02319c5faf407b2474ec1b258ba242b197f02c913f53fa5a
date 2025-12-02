import { Buffer } from 'node:buffer';
import { decoder } from '../lib/buffer_utils.js';
function normalize(input) {
    let encoded = input;
    if (encoded instanceof Uint8Array) {
        encoded = decoder.decode(encoded);
    }
    return encoded;
}
const encode = (input) => Buffer.from(input).toString('base64url');
export const decodeBase64 = (input) => new Uint8Array(Buffer.from(input, 'base64'));
export const encodeBase64 = (input) => Buffer.from(input).toString('base64');
export { encode };
export const decode = (input) => new Uint8Array(Buffer.from(normalize(input), 'base64'));
