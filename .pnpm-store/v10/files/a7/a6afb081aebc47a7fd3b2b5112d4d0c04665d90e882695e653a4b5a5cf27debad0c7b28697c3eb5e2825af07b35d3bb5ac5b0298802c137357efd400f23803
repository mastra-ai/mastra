import webcrypto, { isCryptoKey } from './webcrypto.js';
import isKeyObject from './is_key_object.js';
export default (key) => isKeyObject(key) || isCryptoKey(key);
const types = ['KeyObject'];
if (globalThis.CryptoKey || webcrypto?.CryptoKey) {
    types.push('CryptoKey');
}
export { types };
