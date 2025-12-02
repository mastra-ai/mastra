import crypto, { isCryptoKey } from './webcrypto.js';
import { checkSigCryptoKey } from '../lib/crypto_key.js';
import invalidKeyInput from '../lib/invalid_key_input.js';
import { types } from './is_key_like.js';
import normalize from './normalize_key.js';
export default async function getCryptoKey(alg, key, usage) {
    if (usage === 'sign') {
        key = await normalize.normalizePrivateKey(key, alg);
    }
    if (usage === 'verify') {
        key = await normalize.normalizePublicKey(key, alg);
    }
    if (isCryptoKey(key)) {
        checkSigCryptoKey(key, alg, usage);
        return key;
    }
    if (key instanceof Uint8Array) {
        if (!alg.startsWith('HS')) {
            throw new TypeError(invalidKeyInput(key, ...types));
        }
        return crypto.subtle.importKey('raw', key, { hash: `SHA-${alg.slice(-3)}`, name: 'HMAC' }, false, [usage]);
    }
    throw new TypeError(invalidKeyInput(key, ...types, 'Uint8Array'));
}
