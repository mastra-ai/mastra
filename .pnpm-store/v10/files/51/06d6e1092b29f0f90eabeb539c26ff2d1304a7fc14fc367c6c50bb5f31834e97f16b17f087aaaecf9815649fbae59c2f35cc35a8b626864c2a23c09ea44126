import { getCiphers } from 'node:crypto';
let ciphers;
export default (algorithm) => {
    ciphers ||= new Set(getCiphers());
    return ciphers.has(algorithm);
};
