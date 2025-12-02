import { decode } from './base64url.js';
import importJWK from './jwk_to_key.js';
const normalizeSecretKey = (k) => decode(k);
let privCache;
let pubCache;
const isKeyObject = (key) => {
    return key?.[Symbol.toStringTag] === 'KeyObject';
};
const importAndCache = async (cache, key, jwk, alg) => {
    let cached = cache.get(key);
    if (cached?.[alg]) {
        return cached[alg];
    }
    const cryptoKey = await importJWK({ ...jwk, alg });
    if (!cached) {
        cache.set(key, { [alg]: cryptoKey });
    }
    else {
        cached[alg] = cryptoKey;
    }
    return cryptoKey;
};
const normalizePublicKey = (key, alg) => {
    if (isKeyObject(key)) {
        let jwk = key.export({ format: 'jwk' });
        delete jwk.d;
        delete jwk.dp;
        delete jwk.dq;
        delete jwk.p;
        delete jwk.q;
        delete jwk.qi;
        if (jwk.k) {
            return normalizeSecretKey(jwk.k);
        }
        pubCache || (pubCache = new WeakMap());
        return importAndCache(pubCache, key, jwk, alg);
    }
    return key;
};
const normalizePrivateKey = (key, alg) => {
    if (isKeyObject(key)) {
        let jwk = key.export({ format: 'jwk' });
        if (jwk.k) {
            return normalizeSecretKey(jwk.k);
        }
        privCache || (privCache = new WeakMap());
        return importAndCache(privCache, key, jwk, alg);
    }
    return key;
};
export default { normalizePublicKey, normalizePrivateKey };
