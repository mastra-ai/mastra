import { isCryptoKey } from './webcrypto.js';
export default (key) => {
    if (isCryptoKey(key)) {
        return true;
    }
    return key?.[Symbol.toStringTag] === 'KeyObject';
};
export const types = ['CryptoKey'];
